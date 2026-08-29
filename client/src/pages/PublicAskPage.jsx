import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Send, Radio, Check, Loader2, Calendar } from "lucide-react";
import { io } from "socket.io-client";
import Brand from "../components/Brand";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../api/axios";

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTargetTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PublicAskPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [roomInfo, setRoomInfo] = useState(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [untilStart, setUntilStart] = useState(0);
  const [untilEnd, setUntilEnd] = useState(0);

  // 1. Fetch live session status from server
  const fetchStatus = async () => {
    try {
      const res = await API.get(`/api/rooms/public/${roomCode}`);
      setRoomInfo(res.data);

      const now = Date.now();
      const startMs = new Date(res.data.startsAt).getTime();
      const endMs = new Date(res.data.expiresAt).getTime();

      const diffStart = Math.max(0, Math.floor((startMs - now) / 1000));
      const diffEnd = Math.max(0, Math.floor((endMs - now) / 1000));

      setUntilStart(diffStart);
      setUntilEnd(diffEnd);
    } catch (err) {
      setError(err.response?.data?.message || "Session not found or unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [roomCode]);

  // 2. Real-time WebSocket connection to receive live "session_ended" updates
  useEffect(() => {
    if (!roomCode) return;

    const socket = io("http://localhost:3000");
    socket.emit("join_room", roomCode);
    socket.emit("joinRoom", roomCode);

    socket.on("session_ended", () => {
      setUntilEnd(0);
      setRoomInfo((prev) => (prev ? { ...prev, status: "Expired", canSend: false, isAccepting: false } : prev));
    });

    return () => socket.disconnect();
  }, [roomCode]);

  // 3. Real-time timer tick
  useEffect(() => {
    if (!roomInfo) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const startMs = new Date(roomInfo.startsAt).getTime();
      const endMs = new Date(roomInfo.expiresAt).getTime();

      const diffStart = Math.max(0, Math.floor((startMs - now) / 1000));
      const diffEnd = Math.max(0, Math.floor((endMs - now) / 1000));

      setUntilStart(diffStart);
      setUntilEnd(diffEnd);
    }, 1000);

    return () => clearInterval(interval);
  }, [roomInfo]);

  // Auto-sync status when countdown hits 0 so it unlocks seamlessly without refresh
  useEffect(() => {
    if (untilStart === 0 && roomInfo && !roomInfo.canSend) {
      fetchStatus();
    }
  }, [untilStart === 0]);

  // 4. Submit real anonymous message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await API.post(`/api/rooms/public/${roomCode}/messages`, { content: text.trim() });
      setText("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to send message.";
      if (
        msg.toLowerCase().includes("expire") ||
        msg.toLowerCase().includes("closed") ||
        msg.toLowerCase().includes("not accepting") ||
        err.response?.status === 400
      ) {
        // Immediately lock the page into the Session Ended state
        setUntilEnd(0);
        setRoomInfo((prev) => (prev ? { ...prev, status: "Expired", canSend: false, isAccepting: false } : prev));
      } else {
        alert(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="public-wrap">
        <Brand onClick={() => navigate("/")} />
        <div style={{ marginTop: 60 }}>
          <LoadingSpinner text="Connecting to live AMA room..." />
        </div>
      </div>
    );
  }

  if (error || !roomInfo) {
    return (
      <div className="public-wrap">
        <Brand onClick={() => navigate("/")} />
        <div className="public-card" style={{ marginTop: 40, textAlign: "center" }}>
          <h2>Room Unavailable</h2>
          <p style={{ color: "var(--text-dim)", marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Determine current stage: 'scheduled' | 'active' | 'ended'
  const isScheduled = untilStart > 0;
  const isExpired = untilEnd <= 0 || roomInfo.status === "Expired" || roomInfo.isAccepting === false;
  const isActive = !isScheduled && !isExpired;

  return (
    <div className="public-wrap">
      <div style={{ marginBottom: 30 }}><Brand onClick={() => navigate("/")} /></div>
      <div className="public-card">
        <div className="public-header">
          <span className="eyebrow">
            <Radio size={13} />
            {isScheduled ? "Scheduled Session" : isActive ? "Live AMA Session" : "Session Closed"}
          </span>
          <h1>{roomInfo.title}</h1>
          <p>Ask whatever is on your mind. Your identity stays completely anonymous.</p>

          {/* Dynamic timer badge based on room status */}
          <div className="timer-badge">
            <Clock size={14} />
            {isScheduled ? (
              <span>Opens at {formatTargetTime(roomInfo.startsAt)} · starts in {formatClock(untilStart)}</span>
            ) : isExpired ? (
              <span>Session Ended</span>
            ) : (
              <span>{formatClock(untilEnd)} remaining</span>
            )}
          </div>
        </div>

        {sent && (
          <div className="sent-toast">
            <Check size={15} /> Your question is live on the host's screen.
          </div>
        )}

        {/* 1. SCHEDULED STATE */}
        {isScheduled ? (
          <div className="empty-feed" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "40px 24px" }}>
            <Calendar size={36} style={{ color: "var(--accent)", marginBottom: 12 }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>This session has not started yet</h3>
            <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6 }}>
              The host scheduled this room to open at <strong>{formatTargetTime(roomInfo.startsAt)}</strong>.
              <br />
              Question submissions will unlock automatically in <strong>{formatClock(untilStart)}</strong>.
            </p>
          </div>
        ) : isActive ? (
          /* 2. ACTIVE LIVE AMA STATE */
          <form className="ask-box" onSubmit={handleSubmit}>
            <textarea
              className="ask-textarea"
              placeholder="What do you want to ask?"
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="ask-foot">
              <span className="char-count mono">{text.length}/300</span>
              <button
                className="btn btn-primary btn-sm"
                type="submit"
                disabled={!text.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>Sending... <Loader2 size={13} className="spin" /></>
                ) : (
                  <>Send <Send size={14} /></>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* 3. EXPIRED / CLOSED STATE */
          <div className="empty-feed" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "40px 20px" }}>
            <Clock size={36} style={{ color: "var(--text-faint)", marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Session Ended</h3>
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
              This room is now closed and is no longer accepting new questions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}