import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

/**
 * Extracts IP Address, Location (City/Country), Device Summary, and Hardware Model
 * from incoming HTTP Express Request headers, handling Chrome Android User-Agent Reduction ('K').
 */
export function parseClientMetadata(req) {
  // 1. Extract IP Address (handling proxies like Vercel / Cloudflare)
  const rawIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.ip || req.socket?.remoteAddress || "";
  const ipAddress = rawIp.split(",")[0].trim().replace(/^::ffff:/, "");

  // 2. Resolve Geolocation (City, Country)
  let location = "Unknown Location";
  if (ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress === "localhost") {
    location = "Localhost (Development)";
  } else if (ipAddress) {
    const geo = geoip.lookup(ipAddress);
    if (geo) {
      const city = geo.city ? `${geo.city}, ` : "";
      const country = geo.country || "";
      location = `${city}${country}`.trim();
    }
  }

  // 3. Check Sec-CH-UA Client Hints headers (Modern Chrome / Android sends actual model here)
  const clientHintModel = req.headers["sec-ch-ua-model"]
    ? req.headers["sec-ch-ua-model"].replace(/"/g, "").trim()
    : "";
  const clientHintPlatform = req.headers["sec-ch-ua-platform"]
    ? req.headers["sec-ch-ua-platform"].replace(/"/g, "").trim()
    : "";

  // 4. Parse User-Agent (Browser, OS, Device & Hardware Model)
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const vendor = result.device.vendor || "";
  let rawModel = result.device.model || "";
  const osName = result.os.name || clientHintPlatform || "";
  const osVersion = result.os.version || "";
  const browserName = result.browser.name || "";

  // Chrome Android User-Agent Reduction replaces device models with privacy placeholder "K"
  if (rawModel.toUpperCase() === "K" || rawModel.toUpperCase() === "BUILD/K") {
    rawModel = "";
  }

  // Determine clean, accurate hardware model
  let deviceModel = "Unknown Model";
  if (clientHintModel && clientHintModel.toUpperCase() !== "K") {
    deviceModel = vendor && !clientHintModel.toLowerCase().startsWith(vendor.toLowerCase())
      ? `${vendor} ${clientHintModel}`
      : clientHintModel;
  } else if (rawModel) {
    deviceModel = vendor && !rawModel.toLowerCase().startsWith(vendor.toLowerCase())
      ? `${vendor} ${rawModel}`
      : rawModel;
  } else {
    // Fallback: Check for Android Build code (e.g. Build/TP1A.220624.014 or Build/RMX3085)
    const buildMatch = userAgent.match(/Build\/([A-Za-z0-9._-]+)/i);
    if (buildMatch && buildMatch[1] && buildMatch[1].toUpperCase() !== "K") {
      const buildCode = buildMatch[1];
      deviceModel = vendor ? `${vendor} (${buildCode})` : `${osName || "Android"} (${buildCode})`;
    } else if (vendor) {
      deviceModel = `${vendor} Mobile`;
    } else if (osName) {
      deviceModel = `${osName} Device`;
    }
  }

  // General Device Summary (e.g. "Mobile (Android 11 / Chrome)")
  const deviceType = result.device.type
    ? (result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1))
    : (userAgent.toLowerCase().includes("mobile") ? "Mobile" : "Desktop");

  const deviceSummary = `${deviceType} (${osName} ${osVersion} / ${browserName})`.trim();

  return {
    ipAddress: ipAddress || "Unknown IP",
    location: location || "Unknown Location",
    device: deviceSummary,
    deviceModel: deviceModel,
  };
}
