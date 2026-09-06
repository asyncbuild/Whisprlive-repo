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

import { useToast } from "../context/ToastContext";
import { getClientDeviceModel } from "../utils/deviceInfo";
import { trackEvent } from "../utils/analytics";

function WhatsAppIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662a11.87 11.87 0 005.705 1.454h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function PublicAskPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    if (roomCode?.toLowerCase() === "demo") {
      setRoomInfo({
        title: "Interactive WhisprLive Demo Room",
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        status: "Active",
        canSend: true,
        isDemo: true
      });
      setUntilStart(0);
      setUntilEnd(3600);
      setLoading(false);
      return;
    }

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

    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    const joinRoomAndSync = () => {
      socket.emit("join_room", roomCode);
      socket.emit("joinRoom", roomCode);
      fetchStatus();
    };

    socket.on("connect", joinRoomAndSync);

    socket.on("session_ended", (data) => {
      setUntilEnd(0);
      setRoomInfo((prev) => (prev ? { ...prev, status: "Expired", canSend: false, isAccepting: false } : prev));
      if (data?.reason) {
        toast.info(data.reason);
      }
    });

    // Mobile visibility sync: Re-check status when user unlocks phone or switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      socket.off("connect", joinRoomAndSync);
      socket.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomCode]);

  // 3. Real-time timer tick & periodic status fallback
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

    // Periodic 10s fallback status check while active to handle mobile backgrounding
    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible" && roomInfo.canSend) {
        fetchStatus();
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [roomInfo]);

  // Auto-sync status when countdown hits 0 so it unlocks or locks seamlessly without refresh
  useEffect(() => {
    if ((untilStart === 0 || untilEnd === 0) && roomInfo) {
      if (untilEnd === 0) {
        setRoomInfo((prev) => (prev ? { ...prev, status: "Expired", canSend: false, isAccepting: false } : prev));
      }
      fetchStatus();
    }
  }, [untilStart === 0, untilEnd === 0]);

  // 4. Submit real anonymous message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    if (roomCode?.toLowerCase() === "demo" || roomInfo?.isDemo) {
      setTimeout(() => {
        setText("");
        setSent(true);
        setIsSubmitting(false);
        toast.success("🎉 Question sent! Experience how fast WhisprLive delivers live Q&A.");
        setTimeout(() => setSent(false), 3500);
      }, 300);
      return;
    }

    try {
      const clientDeviceModel = await getClientDeviceModel();
      await API.post(`/api/rooms/public/${roomCode}/messages`, {
        content: text.trim(),
        clientDeviceModel: clientDeviceModel || undefined
      });
      trackEvent("question_submitted", "PublicRoom", roomCode);
      setText("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to send message.";
      if (
        msg.toLowerCase().includes("expire") ||
        msg.toLowerCase().includes("closed") ||
        msg.toLowerCase().includes("not accepting") ||
        msg.toLowerCase().includes("limit") ||
        err.response?.status === 403 ||
        err.response?.status === 400
      ) {
        // Immediately lock the page into the Session Ended state
        setUntilEnd(0);
        setRoomInfo((prev) => (prev ? { ...prev, status: "Expired", canSend: false, isAccepting: false } : prev));
        toast.info(msg);
      } else {
        toast.error(msg);
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
        {roomCode?.toLowerCase() === "demo" && (
          <div style={{
            marginBottom: 20,
            padding: "12px 16px",
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-md)",
            fontSize: 13.5,
            color: "var(--accent)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <Radio size={15} style={{ color: "var(--live)", flexShrink: 0 }} />
            <span><strong>Interactive Demo Room:</strong> Type any test question below to experience how fast WhisprLive delivers live Q&amp;A!</span>
          </div>
        )}

        <div className="public-header">
          <span className="eyebrow">
            <Radio size={13} />
            {isScheduled ? "Scheduled Session" : isActive ? "Live AMA Session" : "Session Closed"}
          </span>
          <h1>{roomInfo.title}</h1>
          <p>Ask whatever is on your mind. Your identity stays completely anonymous.</p>

          {/* Dynamic timer badge based on room status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
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
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`📢 Ask your questions live in *${roomInfo.title}* on WhisprLive:\n👉 ${window.location.href}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                height: 36,
                padding: "0 16px",
                boxShadow: "0 2px 8px rgba(37, 211, 102, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 999,
                textDecoration: "none",
                boxSizing: "border-box"
              }}
            >
              <WhatsAppIcon size={14} /> Share on WhatsApp
            </a>
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