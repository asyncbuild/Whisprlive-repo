import { useState, useMemo } from "react";
import { Cloud } from "lucide-react";

// Curated organic jewel-tone color palette matching reference word cloud
const CLOUD_COLORS = [
  "#322359", // Deep Royal Purple
  "#5f1d4b", // Plum Wine
  "#965830", // Cinnamon Bronze
  "#1d4b68", // Deep Slate Cyan
  "#2a887a", // Vibrant Emerald Teal
  "#8f7c32", // Golden Olive
  "#4b6f28", // Olive Green
  "#277943", // Forest Green
  "#682121", // Dark Maroon
  "#234b8c", // Cobalt Blue
  "#49226d", // Deep Amethyst
  "#79872e", // Warm Moss Ochre
  "#273b88", // Sapphire Navy
  "#82276c", // Mulberry Magenta
  "#37788e", // Steel Teal
  "#822f25", // Terracotta Rust
  "#293b7f", // Midnight Indigo
  "#66336a", // Dusty Heather
];

// Dark mode adapted luminous tones
const CLOUD_COLORS_DARK = [
  "#A78BFA", // Bright Violet
  "#F472B6", // Rose Pink
  "#F59E0B", // Warm Amber
  "#38BDF8", // Sky Blue
  "#2DD4BF", // Teal
  "#A3E635", // Lime
  "#34D399", // Emerald
  "#FB7185", // Coral
  "#818CF8", // Indigo
  "#C084FC", // Purple
  "#E879F9", // Fuchsia
  "#FBBF24", // Yellow Gold
  "#67E8F9", // Cyan
  "#4ADE80", // Light Green
];

/**
 * WordCloudVisualizer
 * Renders an organic, cloud-shaped typographic word cloud matching real presentation visualizers.
 * Words are packed along an Archimedean spiral from center outwards, sized proportionally to vote count.
 */
export default function WordCloudVisualizer({
  words = [],
  minHeight = 280,
  maxHeight = null,
  interactive = true,
  showSummary = true,
  isDark = false,
  className = "",
  style = {}
}) {
  const [hoveredWord, setHoveredWord] = useState(null);

  const totalResponses = useMemo(() => {
    return words.reduce((acc, w) => acc + (w.count || 1), 0);
  }, [words]);

  // Layout calculation using spiral collision detection
  const placedWords = useMemo(() => {
    if (!words || words.length === 0) return [];

    // Sort descending by frequency
    const sorted = [...words].sort((a, b) => (b.count || 1) - (a.count || 1));

    const W = 640;
    const H = 340;
    const cx = W / 2;
    const cy = H / 2;

    const maxCount = Math.max(...sorted.map((w) => w.count || 1), 1);
    const minCount = Math.min(...sorted.map((w) => w.count || 1), 1);

    const placed = [];
    const colors = isDark ? CLOUD_COLORS_DARK : CLOUD_COLORS;

    sorted.forEach((w, idx) => {
      const count = w.count || 1;
      const norm = maxCount === minCount ? 1 : (count - minCount) / (maxCount - minCount);

      // Scale font size: Highest count word is prominent (up to 52px), 1-vote words are compact (14px)
      // Exponential curve gives pleasing hierarchy
      const minFont = sorted.length > 25 ? 13 : 15;
      const maxFont = sorted.length === 1 ? 46 : 52;
      const fontSize = Math.round(minFont + Math.pow(norm, 0.65) * (maxFont - minFont));

      // Bounding box approximation with safety margin
      const textLen = (w.text || "").length;
      const boxW = Math.round(textLen * fontSize * 0.58 + 10);
      const boxH = Math.round(fontSize * 1.08 + 6);

      // Spiral search parameters
      // Use golden angle offset for natural radial packing
      const goldenAngle = (idx * 137.5 * Math.PI) / 180;
      let angle = goldenAngle;
      let placedItem = null;

      // Word 0 goes dead center
      if (idx === 0) {
        placedItem = {
          text: w.text,
          count,
          fontSize,
          x: cx,
          y: cy,
          color: colors[0],
          boxW,
          boxH,
          left: cx - boxW / 2,
          right: cx + boxW / 2,
          top: cy - boxH / 2,
          bottom: cy + boxH / 2
        };
        placed.push(placedItem);
        return;
      }

      // Step outward on Archimedean spiral with aspect ratio stretching (1.5x horizontal)
      for (let step = 1; step < 850; step++) {
        const r = step * 1.7;
        angle += 0.22;
        const testX = cx + r * Math.cos(angle) * 1.48;
        const testY = cy + r * Math.sin(angle) * 0.88;

        const left = testX - boxW / 2;
        const right = testX + boxW / 2;
        const top = testY - boxH / 2;
        const bottom = testY + boxH / 2;

        // Keep within SVG viewport padding
        if (left < 10 || right > W - 10 || top < 12 || bottom > H - 12) {
          continue;
        }

        // Collision detection against all previously placed words
        let collides = false;
        for (let j = 0; j < placed.length; j++) {
          const p = placed[j];
          if (!(left > p.right || right < p.left || top > p.bottom || bottom < p.top)) {
            collides = true;
            break;
          }
        }

        if (!collides) {
          placedItem = {
            text: w.text,
            count,
            fontSize,
            x: testX,
            y: testY,
            color: colors[idx % colors.length],
            boxW,
            boxH,
            left,
            right,
            top,
            bottom
          };
          placed.push(placedItem);
          break;
        }
      }

      // Fallback if spiral didn't find clear space (place with deterministic offset near perimeter)
      if (!placedItem) {
        const fallbackAngle = (idx * 137.5 * Math.PI) / 180;
        const fallbackRadius = 140 + (idx % 5) * 15;
        placed.push({
          text: w.text,
          count,
          fontSize: Math.max(12, fontSize * 0.75),
          x: Math.max(20, Math.min(W - 20, cx + Math.cos(fallbackAngle) * fallbackRadius * 1.4)),
          y: Math.max(20, Math.min(H - 20, cy + Math.sin(fallbackAngle) * fallbackRadius * 0.8)),
          color: colors[idx % colors.length]
        });
      }
    });

    return placed;
  }, [words, isDark]);

  if (!words || words.length === 0) {
    return (
      <div
        className="wordcloud-empty-canvas"
        style={{
          minHeight: maxHeight ? Math.min(minHeight, maxHeight) : Math.min(minHeight, 200),
          height: maxHeight ? maxHeight : "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: isDark ? "rgba(255,255,255,0.02)" : "linear-gradient(180deg, #F8FAFC 0%, var(--surface-2) 100%)",
          borderRadius: "var(--radius-md)",
          padding: "20px 16px",
          textAlign: "center",
          border: "1px solid var(--border)",
          ...style
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(37, 99, 235, 0.16)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10
          }}
        >
          <Cloud size={22} strokeWidth={2} />
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
          No audience words submitted yet
        </div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "5px 0 0", maxWidth: 320, lineHeight: 1.5 }}>
          Words will appear live in an interactive visual cloud as attendees submit them.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`wordcloud-visualizer-container ${className}`}
      style={{
        position: "relative",
        background: isDark ? "rgba(255, 255, 255, 0.02)" : "var(--surface-2)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        ...style
      }}
    >
      {/* Sub-header / Metrics Bar */}
      {showSummary && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            borderBottom: "1px solid var(--border)",
            background: "rgba(0, 0, 0, 0.02)",
            fontSize: 12,
            color: "var(--text-dim)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {totalResponses} {totalResponses === 1 ? "response" : "responses"}
            </span>
            <span>•</span>
            <span>{words.length} unique {words.length === 1 ? "word" : "words"}</span>
          </div>
        </div>
      )}

      {/* ORGANIC WORD CLOUD */}
      <div
          style={{
            position: "relative",
            width: "100%",
            minHeight: maxHeight ? Math.min(minHeight, maxHeight) : minHeight,
            height: maxHeight ? maxHeight : "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 8px"
          }}
        >
          <svg
            viewBox="0 0 640 340"
            style={{
              width: "100%",
              height: maxHeight ? `${maxHeight}px` : "100%",
              maxHeight: maxHeight || Math.max(minHeight, 340),
              overflow: "visible",
              userSelect: "none"
            }}
          >
            {placedWords.map((w, idx) => {
              const isHovered = hoveredWord?.text === w.text;
              const hasHover = hoveredWord !== null;
              const pct = totalResponses > 0 ? Math.round((w.count / totalResponses) * 100) : 0;

              return (
                <g
                  key={`${w.text}-${idx}`}
                  transform={`translate(${w.x}, ${w.y})`}
                  style={{
                    cursor: interactive ? "pointer" : "default",
                    transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
                    opacity: hasHover ? (isHovered ? 1 : 0.42) : 1
                  }}
                  onMouseEnter={() => interactive && setHoveredWord({ ...w, pct })}
                  onMouseLeave={() => interactive && setHoveredWord(null)}
                >
                  {/* Subtle highlight backing when hovered */}
                  {isHovered && (
                    <rect
                      x={-w.boxW / 2}
                      y={-w.boxH / 2}
                      width={w.boxW}
                      height={w.boxH}
                      rx={6}
                      fill={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"}
                    />
                  )}

                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fill: w.color,
                      fontSize: `${w.fontSize}px`,
                      fontWeight: w.fontSize > 32 ? 800 : w.fontSize > 20 ? 700 : 600,
                      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: "-0.015em",
                      filter: isHovered ? "drop-shadow(0 2px 8px rgba(0,0,0,0.2))" : "none",
                      transform: isHovered ? "scale(1.1)" : "scale(1)",
                      transformOrigin: "center",
                      transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    }}
                  >
                    {w.text}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip displaying count & percentage on hover */}
          {hoveredWord && (
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(15, 23, 42, 0.92)",
                color: "#FFFFFF",
                backdropFilter: "blur(6px)",
                padding: "5px 14px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                pointerEvents: "none",
                zIndex: 10,
                animation: "fadeIn 0.15s ease"
              }}
            >
              <span>"{hoveredWord.text}"</span>
              <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>•</span>
              <span style={{ color: "#FF5A36" }}>
                {hoveredWord.count} {hoveredWord.count === 1 ? "vote" : "votes"}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.7)" }}>
                ({hoveredWord.pct}%)
              </span>
            </div>
          )}
        </div>
    </div>
  );
}
