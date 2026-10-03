import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

/**
 * High-performance Floating Live Reactions Overlay
 * Renders floating animated emoji bubbles that float up from bottom and fade out smoothly.
 * Supports both socket-driven streaming and imperative ref.triggerReaction(emoji).
 */
const LiveReactionsOverlay = forwardRef(function LiveReactionsOverlay({ socket, roomCode }, ref) {
  const [reactions, setReactions] = useState([]);

  const addReaction = useCallback((emoji) => {
    if (!emoji) return;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const leftOffset = 15 + Math.random() * 70; // 15% to 85% horizontal spread
    const duration = 2.4 + Math.random() * 1.2; // 2.4s to 3.6s float duration
    const scale = 0.9 + Math.random() * 0.4; // size variation
    const rotation = (Math.random() - 0.5) * 36; // slight tilt

    const item = { id, emoji, leftOffset, duration, scale, rotation };

    setReactions((prev) => [...prev.slice(-40), item]);

    // Cleanup after animation finishes
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, duration * 1000 + 100);
  }, []);

  useImperativeHandle(ref, () => ({
    triggerReaction: (emoji) => addReaction(emoji)
  }), [addReaction]);

  useEffect(() => {
    if (!socket) return;

    const handleLiveReaction = (data) => {
      if (data && data.emoji) {
        addReaction(data.emoji);
      }
    };

    socket.on("live_reaction", handleLiveReaction);

    return () => {
      socket.off("live_reaction", handleLiveReaction);
    };
  }, [socket, addReaction]);

  if (reactions.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 99999,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes floatUpFade {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.6) rotate(0deg);
          }
          15% {
            opacity: 1;
            transform: translateY(-40px) scale(1.2) rotate(var(--rot, -6deg));
          }
          70% {
            opacity: 0.95;
            transform: translateY(-240px) scale(1.05) rotate(var(--rot, 6deg));
          }
          100% {
            opacity: 0;
            transform: translateY(-400px) scale(0.8) rotate(var(--rot, -10deg));
          }
        }
      `}</style>
      {reactions.map((r) => (
        <div
          key={r.id}
          style={{
            position: "absolute",
            bottom: "40px",
            left: `${r.leftOffset}%`,
            fontSize: "34px",
            lineHeight: 1,
            transform: `scale(${r.scale}) rotate(${r.rotation}deg)`,
            animation: `floatUpFade ${r.duration}s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
});

export default LiveReactionsOverlay;
