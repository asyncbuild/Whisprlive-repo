import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

/**
 * Extracts IP Address, Location (City/Country), Device Summary, and Hardware Model (e.g. RMX3085)
 * from incoming HTTP Express Request headers.
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

  // 3. Parse User-Agent (Browser, OS, Device & Hardware Model)
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const vendor = result.device.vendor || "";
  const rawModel = result.device.model || "";
  const osName = result.os.name || "";
  const osVersion = result.os.version || "";
  const browserName = result.browser.name || "";

  // Exact Hardware Model Code (e.g. "Realme RMX3085", "Samsung SM-S918B")
  let deviceModel = "Unknown Model";
  if (rawModel) {
    deviceModel = vendor ? `${vendor} ${rawModel}` : rawModel;
  } else if (vendor) {
    deviceModel = `${vendor} Device`;
  } else if (osName) {
    deviceModel = `${osName} Device`;
  }

  // General Device Summary (e.g. "Mobile (Android 11 / Chrome)")
  const deviceType = result.device.type ? (result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1)) : "Desktop";
  const deviceSummary = `${deviceType} (${osName} ${osVersion} / ${browserName})`.trim();

  return {
    ipAddress: ipAddress || "Unknown IP",
    location: location || "Unknown Location",
    device: deviceSummary,
    deviceModel: deviceModel,
  };
}
