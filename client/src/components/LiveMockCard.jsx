import React, { useState, useEffect } from "react";
import { Send } from "lucide-react";

const SAMPLE_QUESTIONS = [
  "How does WhisprLive hold up with 500+ people in one room?",
  "Can I export every response once the session ends?",
  "Do people need an account to ask something?",
  "What happens to the link the moment the timer hits zero?",
  "Can I moderate questions before the room sees them?",
  "Is there a way to pin a question to the top?",
  "Can we reuse one link for a recurring standup?",
  "Does this work if half the room is on mobile data?",
];

const GUESTS = ["Guest 214", "Guest 88", "Guest 501", "Guest 12", "Guest 349", "Guest 77", "Guest 630", "Guest 205"];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() { return Math.random().toString(36).slice(2, 9); }
function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LiveMockCard() {
  const [messages, setMessages] = useState([
    { id: uid(), guest: "Guest 88", text: "Will the recording be shared after?" },
    { id: uid(), guest: "Guest 214", text: "Can we ask follow-ups anonymously too?" },
  ]);
  const [seconds, setSeconds] = useState(14 * 60 + 22);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMessages((prev) => {
        const next = [...prev, { id: uid(), guest: randomFrom(GUESTS), text: randomFrom(SAMPLE_QUESTIONS) }];
        return next.slice(-4);
      });
    }, 2600);
    const clock = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => { clearInterval(msgTimer); clearInterval(clock); };
  }, []);

  return (
    <div className="live-card">
      <div className="live-card-head">
        <div className="live-badge"><span className="live-dot" />LIVE</div>
        <div className="live-card-title">Design crit — checkout flow</div>
        <div className="live-timer mono">{formatClock(seconds)}</div>
      </div>
      <div className="live-feed">
        {messages.map((m) => (
          <div className="bubble" key={m.id}>
            <div className="bubble-meta">{m.guest}</div>
            {m.text}
          </div>
        ))}
      </div>
      <div className="live-card-foot">
        <div className="fake-input">Type a question…</div>
        <button className="icon-btn" style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
