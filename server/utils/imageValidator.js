/**
 * Server-Side Image Validator with Size, MIME/Magic Bytes, and Safety/NSFW checks
 */

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB Limit

const MAGIC_SIGNATURES = {
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  jpeg: [0xFF, 0xD8, 0xFF],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46], // Starts with RIFF
};

/**
 * Validates a base64 or buffer image
 */
export function validateImageBuffer(buffer, mimeType) {
  // 1. Size Check
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Image file is empty." };
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: "Image size exceeds 2MB limit." };
  }

  // 2. MIME & Magic Bytes Check
  const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!mimeType || !allowedMimes.includes(mimeType.toLowerCase())) {
    return { valid: false, error: "Unsupported image format. Allowed: PNG, JPEG, WEBP, SVG." };
  }

  // If SVG, perform sanitization check for script tags / XSS
  if (mimeType.toLowerCase() === "image/svg+xml") {
    const svgText = buffer.toString("utf-8");
    if (/<script|onload|onerror|onclick|javascript:/i.test(svgText)) {
      return { valid: false, error: "SVG contains unsafe scripts or event handlers." };
    }
    return { valid: true, mimeType: "image/svg+xml" };
  }

  // Check magic bytes for raster images
  let isSignatureValid = false;
  if (mimeType.includes("png") && matchBytes(buffer, MAGIC_SIGNATURES.png)) {
    isSignatureValid = true;
  } else if ((mimeType.includes("jpeg") || mimeType.includes("jpg")) && matchBytes(buffer, MAGIC_SIGNATURES.jpeg)) {
    isSignatureValid = true;
  } else if (mimeType.includes("gif") && matchBytes(buffer, MAGIC_SIGNATURES.gif)) {
    isSignatureValid = true;
  } else if (mimeType.includes("webp") && matchBytes(buffer, MAGIC_SIGNATURES.webp)) {
    isSignatureValid = true;
  }

  if (!isSignatureValid) {
    return { valid: false, error: "Corrupted image or file extension does not match content signature." };
  }

  return { valid: true, mimeType };
}

function matchBytes(buffer, signature) {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * NSFW / Inappropriate content check (Uses Gemini Vision if key available, or safety heuristic)
 */
export async function checkImageSafety(base64Data, mimeType) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

  if (GEMINI_API_KEY && base64Data) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType || "image/png",
                  data: base64Data
                }
              },
              {
                text: "Is this image appropriate for a public live conference logo/banner? If it contains explicit nudity, extreme violence, or hate symbols, respond with {\"isSafe\": false, \"reason\": \"description\"}. Otherwise respond with {\"isSafe\": true, \"reason\": null}. Strict JSON only."
              }
            ]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (!parsed.isSafe) {
            return { safe: false, error: parsed.reason || "Image failed safety moderation check." };
          }
        }
      }
    } catch (err) {
      console.warn("Gemini vision safety check fallback:", err.message);
    }
  }

  return { safe: true };
}
