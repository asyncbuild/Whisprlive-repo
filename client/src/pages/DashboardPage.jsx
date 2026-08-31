import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Link2, Play, Trash2, Download,
  Clock, User, LogOut, Radio, Check, Copy,
  MessageCircle, Square, ThumbsUp, CheckCircle2, Search, QrCode, X, AlertTriangle, PlusCircle, Loader2, Calendar, Sparkles, Crown, Lock
} from "lucide-react";
import { io } from "socket.io-client";
import API from "../api/axios";
import Brand from "../components/Brand";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTargetTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFullDateTime(ts) {
  if (!ts) return "Past";
  const d = new Date(ts);
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) + " at " + d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("new"); // "new" | "active" | "past"
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(15);
  const [session, setSession] = useState(null); // { title, duration, roomCode, link, started, expiresAt, startsAt }
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [untilStart, setUntilStart] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | unanswered | answered
  const [sortMode, setSortMode] = useState("new"); // new | top
  const [startMode, setStartMode] = useState("now"); // now | schedule
  const [scheduleTime, setScheduleTime] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  // Loading states
  const [historyLoading, setHistoryLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [exportingCode, setExportingCode] = useState(null);
  const [endingSession, setEndingSession] = useState(false);

  // Modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState(null);

  // Upvoted messages tracking (prevents duplicate votes)
  const handleUpgradeCheckout = async (planType) => {
    const currentToken = localStorage.getItem('pulse_token');
    if (!currentToken) {
      alert('Your session has expired. Please sign in again.');
      navigate("/signin");
      return;
    }
    setUpgradingPlan(planType);
    try {
      const res = await API.post('/api/payments/create-checkout-session', { planType });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to start payment session.';
      if (err.response?.status === 401 || err.response?.status === 403 || errMsg.includes('Token')) {
        toast.error('Your session has expired or is invalid. Please sign in again.');
        localStorage.removeItem('pulse_token');
        localStorage.removeItem('pulse_user');
        navigate("/signin");
      } else {
        toast.error(errMsg);
      }
      setUpgradingPlan(null);
    }
  };

  // Upvoted messages tracking (prevents duplicate votes)
  const [votedIds, setVotedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pulse_voted_messages") || "[]");
    } catch (e) {
      return [];
    }
  });

  // Retrieve user details safely
  const currentUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("pulse_user"));
    } catch (e) {
      return null;
    }
  })();
  const username = currentUser?.username || currentUser?.email || "Host";
  const isSolo = !currentUser?.plan || currentUser?.plan === "SOLO";
  // Handle Stripe Post-Payment Success and initial user sync
  useEffect(() => {
    if (refreshUser) refreshUser();
    const paymentStatus = searchParams.get("payment");
    const newPlan = searchParams.get("plan");

    if (paymentStatus === "success") {
      toast.success(`🎉 Payment successful! Your account has been upgraded to the ${newPlan || "HOST"} plan.`);
      // Clean query parameters from URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshUser]);
  // 1. Restore active session from localStorage on initial page load / refresh
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pulse_active_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.roomCode) {
          setSession(parsed);
          setTab("active");

          const now = Date.now();
          const startMs = new Date(parsed.startsAt || now).getTime();
          const endMs = new Date(parsed.expiresAt || now + 15 * 60000).getTime();

          setUntilStart(Math.max(0, Math.floor((startMs - now) / 1000)));
          setSecondsLeft(Math.max(0, Math.floor((endMs - now) / 1000)));

          // Fetch existing messages from the database
          setMessagesLoading(true);
          API.get(`/api/rooms/${parsed.roomCode}/messages`)
            .then((res) => {
              if (res.data?.messages) {
                const msgs = res.data.messages.map((m) => ({
                  id: m.id,
                  guest: m.guestName || "Anonymous Guest",
                  text: m.content,
                  votes: m.upvotes || 0,
                  answered: m.isAnswered || m.status === "answered",
                  ts: new Date(m.createdAt).getTime()
                }));
                setMessages(msgs);
              }
            })
            .catch(() => {})
            .finally(() => {
              setMessagesLoading(false);
            });
        }
      }
    } catch (e) {
      console.error("Failed to restore session from localStorage:", e);
    }
  }, []);

  // 2. Create room via API
  const generateLink = async () => {
    if (!title.trim() || creatingRoom) return;

    let startsAtIso = undefined;
    if (startMode === "schedule" && scheduleTime) {
      const [hh, mm] = scheduleTime.split(":").map(Number);
      const target = new Date();
      target.setSeconds(0, 0);
      target.setHours(hh, mm);
      if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1); // Next day if past current time
      }
      startsAtIso = target.toISOString();
    }

    setCreatingRoom(true);
    try {
      const payload = {
        title: title.trim(),
        durationMinutes: duration,
        startsAt: startsAtIso
      };
      const res = await API.post("/api/rooms", payload);
      const roomCode = res.data.room;
      const startTime = startsAtIso ? new Date(startsAtIso) : new Date();
      const expiresAt = new Date(startTime.getTime() + duration * 60000).toISOString();

      const sessionData = {
        title: payload.title,
        duration,
        roomCode,
        link: `${window.location.host}/ask/${roomCode}`,
        started: startMode === "now",
        startsAt: startTime.toISOString(),
        expiresAt
      };

      // Persist active session in localStorage
      localStorage.setItem("pulse_active_session", JSON.stringify(sessionData));
      setSession(sessionData);
      setMessages([]);

      const now = Date.now();
      setUntilStart(Math.max(0, Math.floor((startTime.getTime() - now) / 1000)));
      setSecondsLeft(duration * 60);

      setTab("active"); // Automatically switch to the Active session tab
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to create room");
    } finally {
      setCreatingRoom(false);
    }
  };

  // 3. Socket.io connection for live updates
  useEffect(() => {
    if (!session?.roomCode) return;

    const token = localStorage.getItem("pulse_token");
    const socket = io("http://localhost:3000", {
      auth: { token }
    });

    socket.on("connect", () => {
      socket.emit("join_room", session.roomCode);
      socket.emit("joinRoom", session.roomCode);
    });

    socket.on("new_message", (newMsg) => {
      const formatted = {
        id: newMsg.id || Math.random().toString(),
        guest: newMsg.guestName || "Anonymous Guest",
        text: newMsg.content || newMsg.text,
        votes: newMsg.upvotes || 0,
        answered: newMsg.status === "answered" || newMsg.isAnswered === true,
        ts: new Date(newMsg.createdAt || Date.now()).getTime()
      };
      setMessages((prev) => [formatted, ...prev]);
    });

    socket.on("message_upvoted", ({ messageId, upvotes }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, votes: upvotes } : m)));
    });

    socket.on("message_answered", ({ messageId, isAnswered }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, answered: isAnswered } : m)));
    });

    return () => socket.disconnect();
  }, [session?.roomCode]);

  // 4. Timer tick for scheduled start & active session duration
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const startMs = new Date(session.startsAt || now).getTime();
      const endMs = new Date(session.expiresAt || now).getTime();

      const diffStart = Math.max(0, Math.floor((startMs - now) / 1000));
      const diffEnd = Math.max(0, Math.floor((endMs - now) / 1000));

      setUntilStart(diffStart);
      setSecondsLeft(diffEnd);

      // Auto-mark started if waiting time hits 0
      if (diffStart === 0 && !session.started) {
        setSession((prev) => {
          const updated = { ...prev, started: true };
          localStorage.setItem("pulse_active_session", JSON.stringify(updated));
          return updated;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // 5. Load history from API
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await API.get("/api/rooms/history");
      setPastSessions(res.data.rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "past") {
      loadHistory();
    }
  }, [tab]);

  // Export session messages
  const exportSession = async (roomCode) => {
    if (isSolo) {
      toast.info("Exporting responses is a premium feature. Upgrade to Host plan to unlock exports!");
      setShowUpgradeModal(true);
      return;
    }
    setExportingCode(roomCode);
    try {
      const res = await API.get(`/api/rooms/${roomCode}/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `session-${roomCode}-messages.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.error || parsed.message || "Failed to export session");
        } catch (e) {
          toast.error("Failed to export session");
        }
      } else {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to export session");
      }
    } finally {
      setExportingCode(null);
    }
  };

  // Host manually starts session early
  const startSessionEarly = () => {
    const now = new Date();
    const updated = {
      ...session,
      started: true,
      startsAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (session.duration || duration) * 60000).toISOString()
    };
    setSession(updated);
    localStorage.setItem("pulse_active_session", JSON.stringify(updated));
    setUntilStart(0);
    setSecondsLeft((session?.duration || duration) * 60);
  };

  const resetSession = () => {
    localStorage.removeItem("pulse_active_session");
    setSession(null);
    setMessages([]);
    setTitle("");
    setQuery("");
    setFilter("all");
    setSortMode("new");
    setStartMode("now");
    setScheduleTime("");
    setUntilStart(0);
    setSecondsLeft(0);
  };

  const copyLink = () => {
    if (session?.link) {
      navigator.clipboard?.writeText(`http://${session.link}`);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const toggleAnswered = async (id) => {
    const targetMsg = messages.find((m) => m.id === id);
    const nextStatus = targetMsg ? !targetMsg.answered : true;

    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, answered: nextStatus } : m)));

    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/messages/${id}/answered`, {
          isAnswered: nextStatus
        });
      } catch (err) {
        console.error("Failed to sync answered status:", err);
      }
    }
  };

  const upvote = async (id) => {
    const isVoted = votedIds.includes(id);
    const nextVoted = isVoted ? votedIds.filter((vId) => vId !== id) : [...votedIds, id];
    setVotedIds(nextVoted);
    try {
      localStorage.setItem("pulse_voted_messages", JSON.stringify(nextVoted));
    } catch (e) {}

    const delta = isVoted ? -1 : 1;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, votes: Math.max(0, (m.votes || 0) + delta) } : m))
    );

    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/messages/${id}/upvote`, {
          action: isVoted ? "unvote" : "upvote"
        });
      } catch (err) {
        console.error("Failed to sync upvote:", err);
      }
    }
  };

  const visibleMessages = messages
    .filter((m) => (filter === "all" ? true : filter === "answered" ? m.answered : !m.answered))
    .filter((m) => (query.trim() ? (m.text + " " + m.guest).toLowerCase().includes(query.trim().toLowerCase()) : true))
    .sort((a, b) => (sortMode === "top" ? b.votes - a.votes || b.ts - a.ts : b.ts - a.ts));

  const answeredCount = messages.filter((m) => m.answered).length;

  const endSession = async () => {
    if (endingSession) return;
    setEndingSession(true);
    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/end`);
      } catch (err) {
        console.error("Failed to end session on server:", err);
      }
    }
    resetSession();
    loadHistory();
    setEndingSession(false);
    setTab("past");
  };

  const handleLogout = () => {
    if (logout) logout();
    localStorage.removeItem("pulse_active_session");
    navigate("/");
  };

  const isSessionScheduled = untilStart > 0 && !session?.started;

  return (
    <div className="dash-shell">
      <div className="dash-top">
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Brand onClick={() => navigate("/")} />
            <div className="dash-user" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Active Plan Badge */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: (currentUser?.plan === "STUDIO") ? "var(--accent-soft)" : (currentUser?.plan === "HOST") ? "var(--live-soft)" : "var(--surface-2)",
                  color: (currentUser?.plan === "STUDIO") ? "var(--accent)" : (currentUser?.plan === "HOST") ? "var(--live)" : "var(--text-dim)",
                  border: "1px solid var(--border)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em"
                }}
              >
                {currentUser?.plan === "STUDIO" && <Crown size={12} />}
                {currentUser?.plan === "HOST" && <Sparkles size={12} />}
                {currentUser?.plan || "SOLO"} PLAN
              </span>

              {/* Upgrade Button (visible only if free tier) */}
              {(!currentUser?.plan || currentUser?.plan === "SOLO") && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ padding: "5px 12px", fontSize: 12 }}
                  onClick={() => setShowUpgradeModal(true)}
                >
                  <Sparkles size={12} /> Upgrade
                </button>
              )}

              <div className="user-pill">
                <span className="avatar"><User size={13} /></span>
                {username}
              </div>

              <button className="icon-btn" onClick={handleLogout} title="Sign out">
                <LogOut size={15} />
              </button>
            </div>
        </div>
      </div>

      <div className="dash-body container">
        <div className="dash-head">
          <div>
            <h1>Sessions</h1>
            <p style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 14.5 }}>
              Create a room, share the link, and watch questions arrive live.
            </p>
          </div>
        </div>

        {/* 3 Tabs: New session | Active session | Past sessions */}
        <div className="tabs">
          <button className={`tab ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>
            New session
          </button>
          <button className={`tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
            Active session {session && <span className="live-dot" style={{ display: "inline-block", marginLeft: 6 }} />}
          </button>
          <button className={`tab ${tab === "past" ? "active" : ""}`} onClick={() => setTab("past")}>
            Past sessions
          </button>
        </div>

        {/* TAB 1: CREATE NEW SESSION */}
        {tab === "new" && (
          <div>
            <div className="new-session-card">
              <div className="ns-row">
                <div className="ns-title-field">
                  <label>Session title</label>
                  <input
                    placeholder="e.g. Product roadmap Q&A"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="duration-field">
                  <label>Duration</label>
                  <div className="duration-pills">
                    {(() => {
                      const plan = currentUser?.plan || "SOLO";
                      const availableDurations = plan === "STUDIO" ? [5, 15, 30, 60, 120] : plan === "HOST" ? [5, 15, 30, 60] : [5, 15];
                      return availableDurations.map((d) => (
                        <button
                          key={d}
                          className={`duration-pill ${duration === d ? "active" : ""}`}
                          onClick={() => setDuration(d)}
                        >
                          {d} min
                        </button>
                      ));
                    })()}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={generateLink}
                  disabled={!title.trim() || creatingRoom || (startMode === "schedule" && !scheduleTime)}
                >
                  {creatingRoom ? (
                    <>Creating... <Loader2 size={15} className="spin" /></>
                  ) : (
                    <>Generate link <Link2 size={15} /></>
                  )}
                </button>
              </div>

              <div className="schedule-row" style={{ marginTop: 20 }}>
                <span className="schedule-label">Start timing:</span>
                <div className="chip-row">
                  <button className={`chip ${startMode === "now" ? "active" : ""}`} onClick={() => setStartMode("now")}>
                    Start immediately
                  </button>
                  <button className={`chip ${startMode === "schedule" ? "active" : ""}`} onClick={() => setStartMode("schedule")}>
                    Schedule for specific time
                  </button>
                </div>
                {startMode === "schedule" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <input
                      type="time"
                      className="time-input"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                      {scheduleTime ? `Room will open at ${scheduleTime}` : "Select start time"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE LIVE SESSION */}
        {tab === "active" && (
          <div>
            {!session ? (
              <div className="new-session-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <MessageCircle size={38} style={{ color: "var(--text-faint)", marginBottom: 12 }} />
                <h3>No active session</h3>
                <p style={{ color: "var(--text-dim)", marginTop: 6, marginBottom: 20, fontSize: 14 }}>
                  You don't have an ongoing live room right now.
                </p>
                <button className="btn btn-primary" onClick={() => setTab("new")}>
                  <PlusCircle size={15} /> Create a new session
                </button>
              </div>
            ) : (
              <>
                <div className="new-session-card">
                  <div className="ns-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
                        {session.title}
                      </div>
                      <div className="mono" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                        {session.duration}-minute session · Room Code:{" "}
                        <strong style={{ color: "var(--accent)" }}>{session.roomCode}</strong>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {isSessionScheduled ? (
                        <>
                          <span className="opens-badge">
                            <Clock size={14} /> Opens at {formatTargetTime(session.startsAt)} · starts in {formatClock(untilStart)}
                          </span>
                          <button className="btn btn-primary btn-sm" onClick={startSessionEarly}>
                            <Play size={14} /> Start Session Early
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`countdown ${secondsLeft <= 60 ? "urgent" : ""}`}>
                            <Clock size={15} /> {formatClock(secondsLeft)} remaining
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={endSession}
                            disabled={endingSession}
                          >
                            {endingSession ? (
                              <>Ending... <Loader2 size={13} className="spin" /></>
                            ) : (
                              <><Square size={14} /> End session</>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="link-box">
                    <div className="link-box-left">
                      <div
                        className="qr-box"
                        onClick={() => setShowQrModal(true)}
                        title="Click to view large QR code"
                      >
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(`http://${session.link}`)}`}
                          alt="QR code to join session"
                          onError={(e) => {
                            e.target.style.display = "none";
                            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                          }}
                        />
                        <div className="qr-fallback" style={{ display: "none" }}><QrCode size={20} /></div>
                      </div>
                      <span className="url">{session.link}</span>
                    </div>
                    <div className="link-box-actions">
                      <button className="btn btn-soft btn-sm" onClick={() => setShowQrModal(true)}>
                        <QrCode size={14} /> Enlarge QR
                      </button>
                      <button className="btn btn-soft btn-sm" onClick={copyLink}>
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied Link" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="session-panel">
                  <div className="session-panel-head">
                    <div className="live-badge">
                      {!isSessionScheduled && <span className="live-dot" />}
                      <span style={{ color: isSessionScheduled ? "var(--text-faint)" : "var(--live)" }}>
                        {isSessionScheduled ? "SCHEDULED Q&A" : "LIVE MESSAGES"}
                      </span>
                    </div>
                    {!isSessionScheduled && (
                      <span className="mono" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                        {answeredCount}/{messages.length} answered
                      </span>
                    )}
                  </div>

                  {isSessionScheduled ? (
                    <div className="empty-feed" style={{ padding: "60px 20px" }}>
                      <Calendar size={36} style={{ color: "var(--accent)", marginBottom: 12 }} />
                      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Room opens at {formatTargetTime(session.startsAt)}</h3>
                      <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
                        Question submissions will unlock automatically in <strong>{formatClock(untilStart)}</strong>.
                      </p>
                    </div>
                  ) : session.started && messages.length > 0 ? (
                    <>
                      <div className="feed-toolbar">
                        <div className="feed-search">
                          <Search size={14} />
                          <input placeholder="Search questions…" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                        <div className="chip-row">
                          <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                          <button className={`chip ${filter === "unanswered" ? "active" : ""}`} onClick={() => setFilter("unanswered")}>Unanswered</button>
                          <button className={`chip ${filter === "answered" ? "active" : ""}`} onClick={() => setFilter("answered")}>Answered</button>
                          <span className="chip-divider" />
                          <button className={`chip ${sortMode === "new" ? "active" : ""}`} onClick={() => setSortMode("new")}>Newest</button>
                          <button className={`chip ${sortMode === "top" ? "active" : ""}`} onClick={() => setSortMode("top")}><ThumbsUp size={11} /> Top</button>
                        </div>
                      </div>

                      {messagesLoading ? (
                        <LoadingSpinner text="Syncing live room messages..." />
                      ) : (
                        <div className="live-feed">
                          {visibleMessages.length === 0 && (
                            <div className="feed-empty-inline">No questions match that search or filter.</div>
                          )}
                          {visibleMessages.map((m) => {
                            const isVoted = votedIds.includes(m.id);
                            return (
                              <div className={`bubble ${m.answered ? "answered" : ""}`} key={m.id}>
                                <div className="bubble-top">
                                  <div className="bubble-meta">
                                    <span className="bubble-avatar">
                                      {m.guest?.charAt(0)?.toUpperCase() || "G"}
                                    </span>
                                    <span>{m.guest}</span>
                                    {m.answered && <span className="bubble-tag"><CheckCircle2 size={11} /> Answered</span>}
                                  </div>
                                  <div className="bubble-actions">
                                    <button
                                      className={`vote-btn ${isVoted ? "voted" : ""}`}
                                      onClick={() => upvote(m.id)}
                                      title={isVoted ? "Click to remove your upvote" : "Upvote question"}
                                    >
                                      <ThumbsUp size={12} fill={isVoted ? "currentColor" : "none"} /> {m.votes || 0}
                                    </button>
                                    <button
                                      className={`answer-btn ${m.answered ? "done" : ""}`}
                                      onClick={() => toggleAnswered(m.id)}
                                      title={m.answered ? "Mark as unanswered" : "Mark as answered"}
                                    >
                                      <Check size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="bubble-text">{m.text}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-feed">
                      <Radio size={30} />
                      <p>Room's open — waiting on the first question.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: PAST SESSIONS */}
        {tab === "past" && (
          <div className="past-list">
            {historyLoading ? (
              <LoadingSpinner text="Loading past sessions..." />
            ) : pastSessions.length === 0 ? (
              <div className="empty-feed"><Clock size={30} /><p>No past sessions yet.</p></div>
            ) : (
              pastSessions.map((p) => {
                const code = p.roomCode || p.id;
                const titleText = p.title || "Untitled session";
                const responseCount = p._count?.messages ?? p.responses ?? 0;
                const durMinutes = p.durationMinutes ?? p.duration ?? 15;
                const dateStr = formatFullDateTime(p.createdAt || p.date);
                const isExporting = exportingCode === code;

                return (
                  <div className="past-card" key={code}>
                    <div className="past-card-left">
                      <span className="past-card-title">{titleText}</span>
                      <span className="past-card-date" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Clock size={13} style={{ color: "var(--accent)" }} />
                        {dateStr} · Code: <strong style={{ color: "var(--text)" }}>{code}</strong>
                      </span>
                    </div>
                    <div className="past-card-stats">
                      <div className="stat"><span className="stat-num">{responseCount}</span><span className="stat-label">Responses</span></div>
                      <div className="stat"><span className="stat-num">{durMinutes}m</span><span className="stat-label">Duration</span></div>
                    </div>
                    <div className="past-card-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => exportSession(code)}
                        disabled={isExporting}
                        title={isSolo ? "Unlock export with Host plan" : "Export session messages"}
                      >
                        {isExporting ? (
                          <Loader2 size={13} className="spin" />
                        ) : isSolo ? (
                          <Lock size={13} style={{ color: "var(--accent)" }} />
                        ) : (
                          <Download size={13} />
                        )}
                        {isExporting ? "Exporting..." : "Export"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* QR Code Big Popup Modal */}
      {showQrModal && session && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Scan QR Code to Join</h3>
              <button className="modal-close-btn" onClick={() => setShowQrModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="qr-modal-body">
              <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 8 }}>
                {session.title}
              </p>
              <div className="qr-big-box">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encodeURIComponent(`http://${session.link}`)}`}
                  alt="Session QR Code"
                />
              </div>
              <div className="link-box" style={{ width: "100%", marginTop: 0, justifyContent: "center" }}>
                <span className="url">{session.link}</span>
              </div>
              <div className="modal-actions" style={{ justifyContent: "center", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={copyLink}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied Link" : "Copy Link"}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowQrModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-content" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Sparkles size={18} style={{ color: "var(--accent)" }} /> Upgrade Your Account</h3>
              <button className="modal-close-btn" onClick={() => setShowUpgradeModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "20px 0 10px" }}>
              <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 20 }}>
                Unlock longer room timers, higher participant limits, and message exports.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Host Plan</div>
                    <div style={{ fontSize: 24, fontWeight: 800, margin: "8px 0", color: "var(--accent)" }}>₹1,499<span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 400 }}> /mo</span></div>
                    <ul style={{ fontSize: 13, color: "var(--text-dim)", paddingLeft: 16, margin: "12px 0", lineHeight: 1.6 }}>
                      <li>Unlimited live sessions</li>
                      <li>Up to 1,000 guests / room</li>
                      <li>Custom timers up to 60 min</li>
                      <li>Export responses</li>
                      <li>UPI & Cards support</li>
                    </ul>
                  </div>
                  <button
                    className="btn btn-primary btn-block"
                    style={{ marginTop: 12 }}
                    disabled={upgradingPlan === "HOST"}
                    onClick={() => handleUpgradeCheckout("HOST")}
                  >
                    {upgradingPlan === "HOST" ? "Redirecting..." : "Choose Host (₹1,499)"}
                  </button>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Studio Plan</div>
                    <div style={{ fontSize: 24, fontWeight: 800, margin: "8px 0" }}>₹3,999<span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 400 }}> /mo</span></div>
                    <ul style={{ fontSize: 13, color: "var(--text-dim)", paddingLeft: 16, margin: "12px 0", lineHeight: 1.6 }}>
                      <li>Everything in Host</li>
                      <li>5 seats & shared history</li>
                      <li>Timers up to 120 min</li>
                      <li>UPI & Cards support</li>
                    </ul>
                  </div>
                  <button
                    className="btn btn-ghost btn-block"
                    style={{ marginTop: 12 }}
                    disabled={upgradingPlan === "STUDIO"}
                    onClick={() => handleUpgradeCheckout("STUDIO")}
                  >
                    {upgradingPlan === "STUDIO" ? "Redirecting..." : "Choose Studio (₹3,999)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
