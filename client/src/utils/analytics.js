export const GA_MEASUREMENT_ID = "G-JQQB1WYCC5";

// Track custom event in Google Analytics
export function trackEvent(action, category, label, value) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

// Track page view for Single Page Application navigation
export function trackPageView(url) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
}
