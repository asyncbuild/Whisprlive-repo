import { useState, useEffect } from "react";

export function detectGeoCurrencySync() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = navigator.language || navigator.userLanguage || "";

    const isIndia =
      tz.includes("Kolkata") ||
      tz.includes("Calcutta") ||
      tz.includes("India") ||
      lang.toLowerCase().endsWith("-in") ||
      lang.toLowerCase().startsWith("hi");

    if (isIndia) {
      return {
        code: "INR",
        symbol: "₹",
        price: 399,
        formatted: "₹399",
        isIndia: true,
      };
    } else {
      return {
        code: "USD",
        symbol: "$",
        price: 5,
        formatted: "$5",
        isIndia: false,
      };
    }
  } catch (e) {
    return {
      code: "INR",
      symbol: "₹",
      price: 399,
      formatted: "₹399",
      isIndia: true,
    };
  }
}

export function useGeoCurrency() {
  const [geo, setGeo] = useState(() => detectGeoCurrencySync());

  useEffect(() => {
    let isMounted = true;

    async function fetchIpLocation() {
      try {
        const res = await fetch("https://ipwho.is/", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success !== false && data.country_code) {
          const country = data.country_code.toUpperCase();
          if (isMounted) {
            if (country === "IN") {
              setGeo({ code: "INR", symbol: "₹", price: 399, formatted: "₹399", isIndia: true });
            } else {
              setGeo({ code: "USD", symbol: "$", price: 5, formatted: "$5", isIndia: false });
            }
          }
          return;
        }
      } catch (err) {
        // Fallback to secondary IP geolocation API
        try {
          const res2 = await fetch("https://api.country.is", { cache: "no-store" });
          if (!res2.ok) return;
          const data2 = await res2.json();
          if (data2 && data2.country) {
            const country = data2.country.toUpperCase();
            if (isMounted) {
              if (country === "IN") {
                setGeo({ code: "INR", symbol: "₹", price: 399, formatted: "₹399", isIndia: true });
              } else {
                setGeo({ code: "USD", symbol: "$", price: 5, formatted: "$5", isIndia: false });
              }
            }
          }
        } catch (e) {
          // Fallback to sync browser check
        }
      }
    }

    fetchIpLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return geo;
}

export function detectGeoCurrency() {
  return detectGeoCurrencySync();
}
