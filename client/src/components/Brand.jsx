import React from "react";

export default function Brand({ onClick, size = "md" }) {
  const isLarge = size === "lg";
  const isSmall = size === "sm";
  const logoDimension = isLarge ? 40 : isSmall ? 24 : 32;

  return (
    <div
      className={`brand-container ${isLarge ? "brand-lg" : isSmall ? "brand-sm" : ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="brand-logo-badge">
        <img
          src="/Logo Bgless.png"
          alt="WhisprLive Logo"
          width={logoDimension}
          height={logoDimension}
          className="brand-logo-img"
        />
      </div>

      <div className="brand-title">
        <span className="brand-main">Whispr</span>
        <span className="brand-accent">Live</span>
      </div>
    </div>
  );
}
