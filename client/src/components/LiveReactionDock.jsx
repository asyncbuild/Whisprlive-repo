import { useState } from "react";

const REACTION_EMOJIS = [
  { emoji: "👏", label: "Clap" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "💡", label: "Insightful" },
  { emoji: "🤯", label: "Mindblown" },
  { emoji: "🎉", label: "Party" },
];

export default function LiveReactionDock({ onSendReaction, disabled }) {
  const [clickedEmoji, setClickedEmoji] = useState(null);

  const handleClick = (emoji) => {
    if (disabled) return;
    setClickedEmoji(emoji);
    setTimeout(() => setClickedEmoji(null), 300);

    if (onSendReaction) {
      onSendReaction(emoji);
    }
  };

  return (
    <div className="live-reaction-dock" aria-label="Send live reactions">
      <div className="reaction-dock-label">React live:</div>
      <div className="reaction-dock-emojis">
        {REACTION_EMOJIS.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            className={`reaction-btn ${clickedEmoji === emoji ? "is-bouncing" : ""}`}
            onClick={() => handleClick(emoji)}
            title={label}
            aria-label={`Send ${label} reaction`}
            disabled={disabled}
          >
            <span className="reaction-emoji">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
