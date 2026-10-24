import React, { useState, useEffect, useRef } from "react";

/**
 * RollingPrice Component
 * Smoothly rolls price numbers up and down like an odometer/slot-machine
 * when switching between Monthly and Yearly billing cycles.
 */
export default function RollingPrice({
  value,
  currency: propCurrency,
  amount: propAmount,
  period: propPeriod,
  cycle = "YEARLY",
}) {
  let currency = propCurrency || "";
  let amount = propAmount || "";
  let period = propPeriod || "";

  // Auto-parse if a full string like "₹665/mo" or "$8.25/mo" is supplied
  if (value && typeof value === "string") {
    const match = value.match(/^([^0-9]*)([\d,.]+)(\/[a-zA-Z]+)?$/);
    if (match) {
      currency = match[1] || "";
      amount = match[2] || "";
      period = match[3] || "";
    } else {
      amount = value;
    }
  }

  const [current, setCurrent] = useState({ currency, amount, period });
  const [prev, setPrev] = useState(null);
  const [direction, setDirection] = useState("down");
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (amount !== current.amount) {
      setPrev(current);
      setCurrent({ currency, amount, period });
      setDirection(cycle === "YEARLY" ? "down" : "up");

      const timer = setTimeout(() => {
        setPrev(null);
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [amount, currency, period, cycle]);

  return (
    <span
      className="rolling-price-wrap"
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {current.currency && (
        <span
          className="rolling-price-currency"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
          }}
        >
          {current.currency}
        </span>
      )}
      <span
        className="rolling-price-viewport"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {prev && (
          <span
            className={`rolling-price-number exit-${direction}`}
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {prev.amount}
          </span>
        )}
        <span
          className={`rolling-price-number ${
            prev ? `enter-${direction}` : ""
          }`}
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {current.amount}
        </span>
      </span>
      {current.period && (
        <span
          className="rolling-price-period"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
          }}
        >
          {current.period}
        </span>
      )}
    </span>
  );
}
