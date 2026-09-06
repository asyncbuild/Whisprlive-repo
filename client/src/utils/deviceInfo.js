/**
 * Extracts high-entropy Client Hint device model from modern Chrome / Chromium browsers,
 * eliminating generic placeholders like 'K' or 'Android Device'.
 */
export async function getClientDeviceModel() {
  if (typeof window !== "undefined" && navigator?.userAgentData?.getHighEntropyValues) {
    try {
      const uaData = await navigator.userAgentData.getHighEntropyValues(["model", "platform"]);
      if (uaData && uaData.model && uaData.model.trim() !== "" && uaData.model.toUpperCase() !== "K") {
        return uaData.model.trim();
      }
    } catch (e) {
      console.warn("Client Hints model extraction fallback:", e);
    }
  }
  return null;
}
