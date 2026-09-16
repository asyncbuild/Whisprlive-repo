import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock, Send, Radio, Check, Loader2, Calendar, ThumbsUp,
  MessageSquare, BarChart2, Pin, Sparkles
} from "lucide-react";
import { io } from "socket.io-client";
import Brand from "../components/Brand";
import LoadingSpinner from "../components/LoadingSpinner";
import WordCloudVisualizer from "../components/WordCloudVisualizer";
import API from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getClientDeviceModel } from "../utils/deviceInfo";
import { trackEvent } from "../utils/analytics";

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTargetTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

  // Audience Engagement & Interactive States
  const [activeTab, setActiveTab] = useState("ask"); // "ask" | "feed" | "poll"
  const [messages, setMessages] = useState([]);
  const [feedSort, setFeedSort] = useState("top"); // "top" | "new"
  const [activePoll, setActivePoll] = useState(null);
  const [wordInput, setWordInput] = useState("");
  const [isVoting, setIsVoting] = useState(false);

  // Persistent Voter Fingerprint & Voted Records
  const [voterId] = useState(() => {
    let vid = localStorage.getItem("whisprlive_voter_id");
    if (!vid) {
      vid = "vtr_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36);
      localStorage.setItem("whisprlive_voter_id", vid);
    }
    return vid;
  });

  const [votedMessageIds, setVotedMessageIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("whisprlive_public_voted") || "[]");
    } catch {
      return [];
    }
  });

  const [votedPollMap, setVotedPollMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("whisprlive_voted_polls") || "{}");
    } catch {
      return {};
    }
  });

  // 1. Fetch live session status from server
  const fetchStatus = async () => {
    if (roomCode?.toLowerCase() === "demo") {
      setRoomInfo({
        title: "Interactive WhisprLive Demo Room",
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        status: "Active",
        canSend: true,
        showPublicFeed: true,
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

  // 2. Fetch public messages for audience feed
  const fetchPublicMessages = async () => {
    try {
      const res = await API.get(`/api/rooms/public/${roomCode}/messages`);
      setMessages(res.data?.messages || []);
    } catch (err) {
      console.error("Failed to load public messages:", err);
    }
  };

  // 3. Fetch active live poll
  const fetchActivePoll = async () => {
    try {
      const res = await API.get(`/api/rooms/public/${roomCode}/poll/active`);
      const poll = res.data?.poll || null;
      setActivePoll(poll);
      if (poll && poll.isActive) {
        setActiveTab("poll");
      }
    } catch (err) {
      console.error("Failed to load active poll:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPublicMessages();
    fetchActivePoll();
  }, [roomCode]);

  // 4. Real-time WebSocket connection to receive live updates
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
      fetchStatus();
      fetchPublicMessages();
      fetchActivePoll();
    };

    socket.on("connect", joinRoomAndSync);

    socket.on("session_ended", (data) => {
      setUntilEnd(0);
      setRoomInfo((prev) => (prev ? { ...prev, status: "Expired", canSend: false, isAccepting: false } : prev));
      if (data?.reason) {
        toast.info(data.reason);
      }
    });

    // Real-time audience feed & moderation events
    socket.on("new_message", (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [
          {
            id: newMsg.id,
            content: newMsg.content,
            upvotes: newMsg.upvotes || 0,
            isAnswered: newMsg.isAnswered || false,
            isPinned: newMsg.isPinned || false,
            hostReply: newMsg.hostReply || null,
            createdAt: newMsg.createdAt || new Date().toISOString()
          },
          ...prev
        ];
      });
    });

    socket.on("message_upvoted", ({ messageId, upvotes }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, upvotes } : m))
      );
    });

    socket.on("message_answered", ({ messageId, isAnswered }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isAnswered } : m))
      );
    });

    socket.on("message_replied", ({ messageId, hostReply, isAnswered }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, hostReply, isAnswered: isAnswered ?? m.isAnswered } : m))
      );
    });

    socket.on("message_pinned", ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m))
      );
    });

    socket.on("room_settings_updated", (data) => {
      setRoomInfo((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        if (typeof data?.showPublicFeed === "boolean") updated.showPublicFeed = data.showPublicFeed;
        if (typeof data?.isAccepting === "boolean") updated.isAccepting = data.isAccepting;
        if (data?.activityType) updated.activityType = data.activityType;
        return updated;
      });
      if (data?.showPublicFeed) {
        fetchPublicMessages();
      }
    });

    // Real-time Live Poll & Word Cloud events
    socket.on("poll_created", (poll) => {
      setActivePoll(poll);
      setActiveTab("poll");
      const label = poll.type === "WORD_CLOUD" ? "Word Cloud" : "Live Poll";
      toast.info(`📊 Host launched a new ${label}!`);
    });

    socket.on("poll_updated", (poll) => {
      setActivePoll(poll);
    });

    socket.on("poll_ended", () => {
      setActivePoll(null);
      setActiveTab((prev) => (prev === "poll" ? "ask" : prev));
      toast.info("Active poll has ended.");
    });

    // Mobile visibility sync: Re-check status when user unlocks phone or switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchStatus();
        fetchPublicMessages();
        fetchActivePoll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      socket.off("connect", joinRoomAndSync);
      socket.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomCode]);

  // 5. Real-time timer tick & periodic status fallback
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

  // 6. Submit anonymous message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    if (roomCode?.toLowerCase() === "demo" || roomInfo?.isDemo) {
      setTimeout(() => {
        const demoMsg = {
          id: "demo-" + Date.now(),
          content: text.trim(),
          upvotes: 1,
          isAnswered: false,
          isPinned: false,
          hostReply: null,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [demoMsg, ...prev]);
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

  // 7. Toggle Upvote on Public Question
  const handleToggleUpvote = async (messageId) => {
    const isVoted = votedMessageIds.includes(messageId);
    const nextVoted = isVoted
      ? votedMessageIds.filter((id) => id !== messageId)
      : [...votedMessageIds, messageId];

    setVotedMessageIds(nextVoted);
    try {
      localStorage.setItem("whisprlive_public_voted", JSON.stringify(nextVoted));
    } catch { }

    const delta = isVoted ? -1 : 1;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, upvotes: Math.max(0, (m.upvotes || 0) + delta) } : m))
    );

    if (roomCode?.toLowerCase() === "demo") return;

    try {
      await API.patch(`/api/rooms/${roomCode}/messages/${messageId}/upvote`, {
        action: isVoted ? "unvote" : "upvote"
      });
    } catch (err) {
      console.error("Failed to sync upvote:", err);
    }
  };

  // 8. Poll Voting Handler
  const handlePollVote = async (optionId, word) => {
    if (!activePoll || isVoting) return;
    const pollId = activePoll.id;

    if (votedPollMap[pollId]) {
      toast.info("You've already participated in this poll.");
      return;
    }

    setIsVoting(true);

    const nextMap = { ...votedPollMap, [pollId]: optionId || word || true };
    setVotedPollMap(nextMap);
    try {
      localStorage.setItem("whisprlive_voted_polls", JSON.stringify(nextMap));
    } catch { }

    if (roomCode?.toLowerCase() === "demo" || pollId === "demo-poll") {
      setTimeout(() => {
        setActivePoll((prev) => {
          if (!prev) return prev;
          if (prev.type === "CHOICE" && optionId) {
            const total = prev.totalVotes + 1;
            const nextOpts = prev.options.map((opt) => {
              const count = opt.id === optionId ? opt.votes + 1 : opt.votes;
              return { ...opt, votes: count, percentage: Math.round((count / total) * 100) };
            });
            return { ...prev, totalVotes: total, options: nextOpts };
          } else if (prev.type === "WORD_CLOUD" && word) {
            const clean = word.trim().toLowerCase();
            const exists = prev.wordCloud.find((w) => w.text === clean);
            const nextCloud = exists
              ? prev.wordCloud.map((w) => (w.text === clean ? { ...w, count: w.count + 1 } : w))
              : [...prev.wordCloud, { text: clean, count: 1 }];
            return {
              ...prev,
              totalVotes: prev.totalVotes + 1,
              wordCloud: nextCloud.sort((a, b) => b.count - a.count)
            };
          }
          return prev;
        });
        setIsVoting(false);
        setWordInput("");
        toast.success("Vote recorded!");
      }, 200);
      return;
    }

    try {
      const res = await API.post(`/api/rooms/public/${roomCode}/poll/${pollId}/vote`, {
        optionId,
        word,
        voterId
      });
      if (res.data?.poll) {
        setActivePoll(res.data.poll);
      }
      setWordInput("");
      toast.success("Vote recorded!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record vote");
    } finally {
      setIsVoting(false);
    }
  };

  // Sorted messages
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (feedSort === "top") {
        return (b.upvotes || 0) - (a.upvotes || 0) || new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [messages, feedSort]);

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

  const isScheduled = untilStart > 0;
  const isExpired = untilEnd <= 0 || roomInfo.status === "Expired";
  const isAccepting = roomInfo.isAccepting !== false;
  const isActive = !isScheduled && !isExpired;
  const showFeedTab = roomInfo.showPublicFeed !== false;
  const hasVotedActivePoll = activePoll ? Boolean(votedPollMap[activePoll.id]) : false;

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
            <span><strong>Interactive Demo Room:</strong> Send a question, upvote answers, and test live audience polls below!</span>
          </div>
        )}

        <div className="public-header">
          <span className="eyebrow">
            <Radio size={13} />
            {isScheduled
              ? "Scheduled Room"
              : isActive
                ? activePoll
                  ? activePoll.type === "WORD_CLOUD"
                    ? "Live Word Cloud Active"
                    : "Live Poll Active"
                  : "Live Room"
                : "Session Closed"}
          </span>
          <div className="public-title-box">
            <h1>{roomInfo.title}</h1>
          </div>
          <p>Share questions, vote on top topics, and join live polls 100% anonymously.</p>

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
              href={`https://wa.me/?text=${encodeURIComponent(`📢 Join *${roomInfo.title}* on WhisprLive — share anonymous questions & live feedback:\n👉 ${window.location.href}`)}`}
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
            <Check size={15} /> Sent! Your submission is live on the host's screen.
          </div>
        )}

        {/* Audience Segmented Navigation Tabs */}
        {(showFeedTab || activePoll) && (
          <div className="audience-tabs-bar">
            <button
              type="button"
              className={`audience-tab-btn ${activeTab === "ask" ? "active" : ""}`}
              onClick={() => setActiveTab("ask")}
            >
              <Send size={14} /> Ask a Question
            </button>

            {showFeedTab && (
              <button
                type="button"
                className={`audience-tab-btn ${activeTab === "feed" ? "active" : ""}`}
                onClick={() => setActiveTab("feed")}
              >
                <MessageSquare size={14} /> Live Q&A {messages.length > 0 && `(${messages.length})`}
              </button>
            )}

            {activePoll && (
              <button
                type="button"
                className={`audience-tab-btn ${activeTab === "poll" ? "active" : ""}`}
                onClick={() => setActiveTab("poll")}
              >
                <span className="pulse-dot" />
                <BarChart2 size={14} /> {activePoll?.type === "WORD_CLOUD" ? "Live Word Cloud" : "Live Poll"}
              </button>
            )}
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
              Submissions will unlock automatically in <strong>{formatClock(untilStart)}</strong>.
            </p>
          </div>
        ) : (
          <>
            {/* TAB 1: ASK QUESTION */}
            {activeTab === "ask" && (
              isActive ? (
                isAccepting ? (
                  <form className="ask-box" onSubmit={handleSubmit}>
                    <textarea
                      className="ask-textarea"
                      placeholder="Share a question, suggestion, or honest feedback..."
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
                  <div className="empty-feed" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "40px 20px", textAlign: "center" }}>
                    <MessageSquare size={36} style={{ color: "var(--text-faint)", marginBottom: 12 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Questions Paused</h3>
                    <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
                      The host is not accepting questions right now. Waiting for the host to launch the next live activity...
                    </p>
                  </div>
                )
              ) : (
                <div className="empty-feed" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "40px 20px" }}>
                  <Clock size={36} style={{ color: "var(--text-faint)", marginBottom: 12 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Session Ended</h3>
                  <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
                    This room is now closed and is no longer accepting new submissions.
                  </p>
                </div>
              )
            )}

            {/* TAB 2: LIVE AUDIENCE Q&A FEED */}
            {activeTab === "feed" && showFeedTab && (
              <div>
                <div className="pub-feed-toolbar">
                  <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>
                    {sortedMessages.length} {sortedMessages.length === 1 ? "Question" : "Questions"}
                  </span>
                  <div className="pub-sort-pill-group">
                    <button
                      type="button"
                      className={`pub-sort-btn ${feedSort === "top" ? "active" : ""}`}
                      onClick={() => setFeedSort("top")}
                    >
                      Top Voted
                    </button>
                    <button
                      type="button"
                      className={`pub-sort-btn ${feedSort === "new" ? "active" : ""}`}
                      onClick={() => setFeedSort("new")}
                    >
                      Recent
                    </button>
                  </div>
                </div>

                {sortedMessages.length === 0 ? (
                  <div className="empty-feed" style={{ padding: "40px 20px" }}>
                    <MessageSquare size={36} style={{ color: "var(--text-faint)", marginBottom: 10 }} />
                    <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No questions submitted yet. Be the first to ask!</p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={() => setActiveTab("ask")}
                    >
                      Ask a Question
                    </button>
                  </div>
                ) : (
                  <div className="pub-feed-list">
                    {sortedMessages.map((m) => {
                      const isVoted = votedMessageIds.includes(m.id);
                      return (
                        <div key={m.id} className={`pub-q-card ${m.isPinned ? "is-pinned" : ""}`}>
                          <div className="pub-q-top">
                            <div className="pub-badges">
                              {m.isPinned && (
                                <span className="pinned-badge">
                                  <Pin size={11} /> Pinned
                                </span>
                              )}
                              {m.isAnswered && (
                                <span className="answered-badge">
                                  <Check size={11} /> Answered
                                </span>
                              )}
                            </div>
                            <span className="pub-q-time">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="pub-q-content">{m.content}</div>

                          {m.hostReply && (
                            <div className="pub-host-reply">
                              <div className="pub-host-reply-header">
                                <Sparkles size={12} /> Host Answer
                              </div>
                              <div className="pub-host-reply-body">{m.hostReply}</div>
                            </div>
                          )}

                          <div className="pub-q-footer">
                            <button
                              type="button"
                              className={`pub-upvote-btn ${isVoted ? "voted" : ""}`}
                              onClick={() => handleToggleUpvote(m.id)}
                            >
                              <ThumbsUp size={14} />
                              <span>{m.upvotes || 0}</span>
                            </button>
                            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                              {isVoted ? "You upvoted this" : "Upvote to support"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: LIVE POLL & WORD CLOUD */}
            {activeTab === "poll" && (
              activePoll ? (
                <div className="poll-card">
                  <div className="poll-badge-row">
                    <span className="poll-type-badge">
                      <Radio size={12} style={{ color: "var(--live)" }} />
                      {activePoll.type === "WORD_CLOUD" ? "Live Word Cloud" : "Live Multiple Choice Poll"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                      {activePoll.totalVotes} {activePoll.totalVotes === 1 ? "response" : "responses"}
                    </span>
                  </div>

                  <h3 className="poll-question-title">{activePoll.question}</h3>

                  {activePoll.type === "CHOICE" ? (
                    <div className="poll-options-grid">
                      {activePoll.options.map((opt) => {
                        const userPick = votedPollMap[activePoll.id] === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`poll-opt-btn ${userPick ? "user-voted" : ""}`}
                            disabled={hasVotedActivePoll || isVoting}
                            onClick={() => handlePollVote(opt.id)}
                          >
                            <div
                              className="poll-opt-progress-fill"
                              style={{ width: `${opt.percentage || 0}%` }}
                            />
                            <div className="poll-opt-content">
                              <span>
                                {userPick && "✓ "}
                                {opt.text}
                              </span>
                              <span className="poll-opt-pct">
                                {opt.percentage || 0}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      {/* Interactive Word Cloud Visualizer */}
                      <WordCloudVisualizer
                        words={activePoll.wordCloud || []}
                        minHeight={250}
                        style={{ marginBottom: 16 }}
                      />

                      {!hasVotedActivePoll ? (
                        <form
                          className="wordcloud-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (wordInput.trim()) {
                              handlePollVote(null, wordInput.trim());
                            }
                          }}
                        >
                          <input
                            type="text"
                            className="wordcloud-input"
                            placeholder="Type 1 or 2 words..."
                            maxLength={30}
                            value={wordInput}
                            onChange={(e) => setWordInput(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={!wordInput.trim() || isVoting}
                          >
                            Submit Word
                          </button>
                        </form>
                      ) : (
                        <p style={{ fontSize: 13, color: "var(--success)", fontWeight: 600, textAlign: "center", marginTop: 10 }}>
                          ✓ Thank you! Your word is now live in the audience word cloud.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-feed" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "48px 24px", textAlign: "center" }}>
                  <Radio size={36} style={{ color: "var(--live)", marginBottom: 12 }} />
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Waiting for Host Activity</h3>
                  <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
                    The host has not launched an active {roomInfo?.activityType === "WORD_CLOUD" ? "word cloud" : "poll"} yet.
                    Keep this screen open—it will automatically sync the moment they launch!
                  </p>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}