import { useState, useRef } from "react";

const LETTERS = [
  { char: "W", dx: -1.7 },
  { char: "h", dx: -1.3 },
  { char: "i", dx: -0.95 },
  { char: "s", dx: -0.6 },
  { char: "p", dx: -0.25 },
  { char: "r", dx: 0.15 },
  { char: "L", dx: 0.55 },
  { char: "i", dx: 0.95 },
  { char: "v", dx: 1.3 },
  { char: "e", dx: 1.7 },
];

export default function BrandOutro() {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState(0);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const center = rect.width / 2;
    const norm = (x - center) / center; // -1 to +1
    setTilt(norm * 4); // +/- 4 deg tilt
  };

  const handleMouseLeave = () => {
    setTilt(0);
  };

  return (
    <section
      ref={containerRef}
      className="brand-outro-section"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label="WhisprLive Signature"
    >
      {/* Cinematic Ambient Glow & Spotlight */}
      <div className="brand-outro-spotlight" />

      {/* Hanging Wire and Mascot */}
      <div
        className="brand-outro-pendulum"
        style={{
          transform: `rotate(${tilt}deg)`,
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="brand-outro-wire" />
        <div className="brand-outro-mascot-container">
          <div className="brand-outro-halo" />
          <img
            src="/Logo Bgless.png"
            alt="WhisprLive Mascot"
            className="brand-outro-mascot-img"
            width={64}
            height={64}
            loading="lazy"
          />
        </div>
      </div>

      {/* Massive 3D Perspective Typography */}
      <div className="brand-outro-word-wrap">
        {/* Background shadow layer with directional perspective */}
        <div className="brand-outro-layer brand-outro-shadows" aria-hidden="true">
          {LETTERS.map((item, idx) => (
            <span
              key={`shadow-${idx}`}
              className="brand-outro-char shadow-char"
              style={{
                "--dx": (item.dx - tilt * 0.08).toFixed(3),
              }}
            >
              {item.char}
            </span>
          ))}
        </div>

        {/* Foreground illuminated text layer */}
        <div className="brand-outro-layer brand-outro-face">
          {LETTERS.map((item, idx) => (
            <span key={`face-${idx}`} className="brand-outro-char face-char">
              {item.char}
            </span>
          ))}
        </div>
      </div>

      {/* Subtle floor vignette gradient */}
      <div className="brand-outro-floor-gradient" />
    </section>
  );
}

