import React from "react";

export default function Brand({ onClick, size = "md" }) {
  const isLarge = size === "lg";

  return (
    <div
      className={`brand-container ${isLarge ? "brand-lg" : ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="brand-logo-badge">
        <svg
          width={isLarge ? "32" : "26"}
          height={isLarge ? "32" : "26"}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="whisprGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4338CA" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.3" />
            </filter>
          </defs>
          
          {/* Base rounded squircle with glow */}
          <rect width="32" height="32" rx="9" fill="url(#whisprGrad)" filter="url(#glow)" />
          
          {/* Soundwave bars (Whisper / Voice / Realtime response) */}
          <rect x="7" y="12" width="2.8" height="8" rx="1.4" fill="#FFFFFF" opacity="0.75" />
          <rect x="12" y="8" width="2.8" height="16" rx="1.4" fill="#FFFFFF" />
          <rect x="17" y="6" width="2.8" height="20" rx="1.4" fill="#FFFFFF" />
          <rect x="22" y="11" width="2.8" height="10" rx="1.4" fill="#FFFFFF" opacity="0.85" />

          {/* Live broadcast dot indicator on corner */}
          <circle cx="26.5" cy="5.5" r="3.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="brand-title">
        <span className="brand-main">Whispr</span>
        <span className="brand-accent">Live</span>
      </div>
    </div>
  );
}
