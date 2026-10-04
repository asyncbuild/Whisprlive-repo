import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Maximize2, Minimize2, Radio, QrCode, MessageSquare, BarChart3, Cloud,
  Moon, Sun, CheckCircle2, Trophy, Clock, ArrowLeft
} from "lucide-react";
import QRCode from "qrcode";
import io from "socket.io-client";
import API from "../api/axios";
import LiveReactionsOverlay from "../components/LiveReactionsOverlay";
import WordCloudVisualizer from "../components/WordCloudVisualizer";

const SOCKET_URL = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3000" : window.location.origin);

async function generateWatermarkedQr(targetUrl, brandLogo) {
  try {
    const rawQr = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: "H",
      margin: 1.5,
      width: 440,
      color: { dark: "#000000", light: "#00000000" }
    });

    const loadImage = (src) =>
      new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
          // If custom logo fails to load, fallback to default WhisprLive logo
          if (src !== "/Logo Bgless.png") {
            const fallback = new Image();
            fallback.crossOrigin = "anonymous";
            fallback.onload = () => resolve(fallback);
            fallback.onerror = () => resolve(null);
            fallback.src = "/Logo Bgless.png";
          } else {
            resolve(null);
          }
        };
        img.src = src;
      });

    const [qrImg, logoImg] = await Promise.all([
      loadImage(rawQr),
      loadImage(brandLogo || "/Logo Bgless.png")
    ]);

    if (!qrImg) return rawQr;

    const canvas = document.createElement("canvas");
    canvas.width = 440;
    canvas.height = 440;
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawQr;

    // 1. Fill clean white base
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 440, 440);

    // 2. High-contrast QR matrix
    ctx.drawImage(qrImg, 0, 0, 440, 440);

    // 3. Center branded logo badge (High-error-correction safe)
    if (logoImg && logoImg.width && logoImg.height) {
      const badgeSize = 88;
      const bx = (440 - badgeSize) / 2;
      const by = (440 - badgeSize) / 2;

      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, badgeSize, badgeSize, 14);
      } else {
        ctx.rect(bx, by, badgeSize, badgeSize);
      }
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#E2E8F0";
      ctx.stroke();

      const pad = 10;
      const innerSize = badgeSize - pad * 2;
      const aspect = logoImg.width / logoImg.height;
      let lw = innerSize;
      let lh = innerSize;
      if (aspect > 1) {
        lh = innerSize / aspect;
      } else {
        lw = innerSize * aspect;
      }
      const lx = bx + (badgeSize - lw) / 2;
      const ly = by + (badgeSize - lh) / 2;
      ctx.drawImage(logoImg, lx, ly, lw, lh);
      ctx.restore();
    }

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Failed to generate watermarked QR:", err);
    return "";
  }
}

export default function StageProjectorPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [activeTab, setActiveTab] = useState("qa"); // "qa" | "poll" | "wordcloud"
  const [qaSubMode, setQaSubMode] = useState("feed"); // default to "feed" (Grid View) as requested
  const [spotlightMessageId, setSpotlightMessageId] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageTheme, setStageTheme] = useState("dark"); // "dark" | "light" | "midnight"

  const socketRef = useRef(null);

  // Fetch initial stage room data
  useEffect(() => {
    async function loadStageData() {
      try {
        setLoading(true);
        const res = await API.get(`/api/rooms/stage/${roomCode}`);
        const data = res.data;
        setRoom(data.room);
        const validMessages = (data.messages || []).filter((m) => !m.aiFlagged && m.status !== "rejected");
        setMessages(validMessages);
        setActivePoll(data.activePoll || null);
        if (data.room.stageTheme) {
          setStageTheme(data.room.stageTheme);
        }

        // Auto-select tab based on active activity
        if (data.activePoll && data.activePoll.isActive) {
          if (data.activePoll.type === "WORD_CLOUD") {
            setActiveTab("wordcloud");
          } else {
            setActiveTab("poll");
          }
        } else {
          setActiveTab("qa");
        }

        // Set initial spotlight to pinned question if available
        const pinned = (data.messages || []).find((m) => m.isPinned);
        if (pinned) {
          setSpotlightMessageId(pinned.id);
        } else if (data.messages && data.messages.length > 0) {
          setSpotlightMessageId(data.messages[0].id);
        }

        // Generate Watermarked QR code with custom/WhisprLive logo
        const targetSlug = data.room.customSlug || data.room.roomCode;
        const joinUrl = `${window.location.origin}/ask/${targetSlug}`;
        const qr = await generateWatermarkedQr(joinUrl, data.room.brandLogo);
        setQrDataUrl(qr);
      } catch (err) {
        console.error("Stage room fetch error:", err);
        setError(err.response?.data?.message || "Stage room not found or session inactive.");
      } finally {
        setLoading(false);
      }
    }

    if (roomCode) {
      loadStageData();
    }
  }, [roomCode]);

  // Socket Connection for live updates & reactions
  useEffect(() => {
    if (!roomCode) return;

    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("joinRoom", roomCode);
    });

    s.on("new_message", (newMsg) => {
      if (newMsg.status === "rejected" || newMsg.aiFlagged) return; // Block auto-moderated / toxic messages
      setMessages((prev) => [newMsg, ...prev]);
    });

    s.on("message_deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    s.on("message_pinned", ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m))
      );
      if (isPinned) {
        setSpotlightMessageId(messageId);
        setActiveTab("qa");
      }
    });

    s.on("message_upvoted", ({ messageId, upvotes }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, upvotes } : m))
      );
    });

    s.on("message_status_changed", ({ messageId, status }) => {
      setMessages((prev) => {
        if (status === "rejected" || status === "archived") {
          return prev.filter((m) => m.id !== messageId);
        }
        return prev.map((m) => (m.id === messageId ? { ...m, status } : m));
      });
    });

    s.on("message_answered", ({ messageId, isAnswered }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isAnswered } : m))
      );
    });

    s.on("host_replied", ({ messageId, reply }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, hostReply: reply } : m))
      );
    });

    s.on("poll_created", (poll) => {
      setActivePoll(poll);
      setQuizRevealedData(null);
      if (poll.type === "WORD_CLOUD") {
        setActiveTab("wordcloud");
      } else {
        setActiveTab("poll");
      }
    });

    s.on("poll_vote_update", (poll) => {
      setActivePoll(poll);
    });

    s.on("poll_ended", () => {
      setActivePoll(null);
      setQuizRevealedData(null);
    });

    s.on("quiz_revealed", (data) => {
      setQuizRevealedData(data);
      if (activePoll) {
        setActivePoll((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            isQuizRevealed: true,
            options: (prev.options || []).map((o) => ({
              ...o,
              isCorrect: o.id === data.correctOptionId,
            })),
          };
        });
      }
    });

    s.on("branding_updated", async (branding) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          brandLogo: branding.brandLogo,
          brandColor: branding.brandColor,
          stageTheme: branding.stageTheme,
        };
        const targetSlug = updated.customSlug || updated.roomCode;
        const joinUrl = `${window.location.origin}/ask/${targetSlug}`;
        generateWatermarkedQr(joinUrl, branding.brandLogo).then((newQr) => {
          if (newQr) setQrDataUrl(newQr);
        });
        return updated;
      });
      if (branding.stageTheme) {
        setStageTheme(branding.stageTheme);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [roomCode, activePoll]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request error:", err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Determine current spotlight question
  const spotlightQuestion = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    const found = messages.find((m) => m.id === spotlightMessageId);
    if (found) return found;
    return messages.find((m) => m.isPinned) || messages[0];
  }, [messages, spotlightMessageId]);

  if (loading) {
    return (
      <div className="stage-page-container stage-theme-dark stage-loading-screen">
        <div className="stage-spinner" />
        <h2>Initializing Live Stage Projector...</h2>
        <p>Connecting to {roomCode}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stage-page-container stage-theme-dark stage-loading-screen">
        <div className="stage-error-icon">⚠️</div>
        <h2>Stage Screen Unavailable</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate("/")} style={{ marginTop: 20 }}>
          <ArrowLeft size={16} /> Return to Home
        </button>
      </div>
    );
  }

  const joinSlug = room?.customSlug || room?.roomCode || roomCode;
  const brandAccent = room?.brandColor || "var(--accent)";

  return (
    <div
      className={`stage-page-container stage-theme-${stageTheme}`}
      style={{ "--stage-accent": brandAccent }}
    >
      {/* Real-time floating reactions overlay */}
      <LiveReactionsOverlay socket={socketRef.current} roomCode={roomCode} />

      {/* Top Stage Header */}
      <header className="stage-top-bar">
        <div className="stage-brand-block">
          <div className="stage-whispr-badge">
            <img src="/Logo Bgless.png" alt="WhisprLive Logo" className="stage-whispr-logo-img" />
            <span className="stage-live-dot" />
            <span><strong>WhisprLive</strong> Stage</span>
          </div>
          {room?.brandLogo && (
            <img src={room.brandLogo} alt="Event Logo" className="stage-custom-logo" />
          )}
          <h1 className="stage-room-title">{room?.title || "Live Q&A Session"}</h1>
        </div>

        {/* Stage View Mode Toggles (Q&A | Poll | Word Cloud) */}
        <div className="stage-controls">
          <div className="stage-mode-pill-group">
            <button
              className={`stage-mode-pill ${activeTab === "qa" ? "is-active" : ""}`}
              onClick={() => setActiveTab("qa")}
              title="Audience Q&A & Question Stream"
            >
              <MessageSquare size={14} /> Q&A {messages.length > 0 ? `(${messages.length})` : ""}
            </button>
            <button
              className={`stage-mode-pill ${activeTab === "poll" ? "is-active" : ""}`}
              onClick={() => setActiveTab("poll")}
              title="Live Multiple Choice Poll / Quiz"
            >
              <BarChart3 size={14} /> Poll
            </button>
            <button
              className={`stage-mode-pill ${activeTab === "wordcloud" ? "is-active" : ""}`}
              onClick={() => setActiveTab("wordcloud")}
              title="Live Dynamic Word Cloud"
            >
              <Cloud size={14} /> Word Cloud
            </button>
          </div>

          <button
            className="stage-icon-btn"
            onClick={() => setStageTheme((t) => (t === "light" ? "dark" : "light"))}
            title={stageTheme === "light" ? "Switch to Dark Theme" : "Switch to Light Theme"}
          >
            {stageTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button
            className="stage-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Presentation Stage Grid */}
      <main className="stage-main-grid">
        {/* Left / Center: Active Presentation Stage */}
        <section className="stage-content-area">
          {/* TAB 1: AUDIENCE Q&A (Default Grid View) */}
          {activeTab === "qa" && (
            messages.length > 0 ? (
              qaSubMode === "spotlight" && spotlightQuestion ? (
                <div className="stage-spotlight-card">
                  <div className="stage-spotlight-top">
                    <div className="stage-spotlight-badge">
                      <Radio size={14} className="stage-live-pulse" />
                      <span>{spotlightQuestion.isPinned ? "📌 Pinned Question" : "🔥 Question Spotlight"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        className="stage-mode-pill is-active"
                        onClick={() => setQaSubMode("feed")}
                        style={{ fontSize: 12, padding: "5px 12px" }}
                        title="Return to Grid Stream"
                      >
                        ← Back to Question Grid
                      </button>
                      <div className="stage-spotlight-upvotes">
                        <span>▲</span>
                        <strong>{spotlightQuestion.upvotes || 0}</strong>
                        <small>upvotes</small>
                      </div>
                    </div>
                  </div>

                  <blockquote className="stage-spotlight-text">
                    "{spotlightQuestion.content}"
                  </blockquote>

                  {spotlightQuestion.hostReply && (
                    <div className="stage-spotlight-reply">
                      <div className="stage-reply-label">🎤 Host Reply:</div>
                      <p>{spotlightQuestion.hostReply}</p>
                    </div>
                  )}

                  <div className="stage-spotlight-meta">
                    <span>Submitted by audience</span>
                    <span>Scan QR code on the right to participate</span>
                  </div>
                </div>
              ) : (
                <div className="stage-feed-view">
                  <div className="stage-feed-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h2>Live Question Stream ({messages.length})</h2>
                      <span>Audience questions in real time · Click any card to spotlight</span>
                    </div>
                    {spotlightQuestion && (
                      <button
                        className="stage-mode-pill"
                        onClick={() => setQaSubMode("spotlight")}
                        style={{ fontSize: 12, padding: "5px 12px", background: "rgba(255,255,255,0.1)" }}
                      >
                        Spotlight Active
                      </button>
                    )}
                  </div>
                  <div className="stage-feed-grid">
                    {messages.map((m, i) => (
                      <div
                        key={m.id || i}
                        className={`stage-feed-item ${m.id === spotlightMessageId ? "is-pinned" : ""} ${m.isAnswered ? "is-answered" : ""}`}
                        onClick={() => {
                          setSpotlightMessageId(m.id);
                          setQaSubMode("spotlight");
                        }}
                      >
                        <div className="stage-feed-item-top">
                          <span className="stage-feed-upvote-chip">▲ {m.upvotes || 0}</span>
                          {m.isPinned && <span className="stage-feed-pinned-badge">Pinned</span>}
                          {m.isAnswered && <span className="stage-feed-answered-badge">Answered</span>}
                          {m.hostReply && <span className="stage-feed-answered-badge" style={{ color: "#3B82F6" }}>Replied</span>}
                        </div>
                        <p className="stage-feed-item-text">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="stage-spotlight-card" style={{ textAlign: "center", alignItems: "center" }}>
                <div style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  color: "var(--stage-accent, #3B82F6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}>
                  <MessageSquare size={30} />
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>Live Audience Q&A</h2>
                <p style={{ fontSize: 15, opacity: 0.7, maxWidth: 420, margin: "0 0 20px", lineHeight: 1.5 }}>
                  Audience members can scan the QR code to submit questions and upvote in real time.
                </p>
              </div>
            )
          )}

          {/* TAB 2: LIVE MULTIPLE CHOICE POLL / QUIZ */}
          {activeTab === "poll" && (
            activePoll && activePoll.type !== "WORD_CLOUD" ? (
              <div className="stage-poll-card">
                <div className="stage-poll-badge">
                  <BarChart3 size={16} />
                  <span>
                    {activePoll.isQuiz ? "Live Audience Quiz" : "Live Audience Poll"}
                  </span>
                  {activePoll.isQuiz && activePoll.quizTimerSeconds > 0 && !activePoll.isQuizRevealed && (
                    <span className="stage-quiz-timer-chip">
                      <Clock size={13} /> {activePoll.quizTimerSeconds}s Timer
                    </span>
                  )}
                  {activePoll.isQuizRevealed && (
                    <span className="stage-quiz-revealed-chip">
                      <Trophy size={13} /> Correct Answer Revealed!
                    </span>
                  )}
                </div>

                <h2 className="stage-poll-question">{activePoll.question}</h2>

                <div className="stage-poll-options-list">
                  {(activePoll.options || []).map((opt, i) => {
                    const isWinner = activePoll.isQuizRevealed && opt.isCorrect;
                    return (
                      <div
                        key={opt.id || i}
                        className={`stage-poll-option-row ${isWinner ? "is-correct-answer" : ""}`}
                      >
                        <div
                          className="stage-poll-option-bar-fill"
                          style={{ width: `${opt.percentage || 0}%` }}
                        />
                        <div className="stage-poll-option-content">
                          <div className="stage-poll-option-title">
                            <span className="stage-option-letter">{String.fromCharCode(65 + i)}</span>
                            <span>{opt.text}</span>
                            {isWinner && (
                              <span className="stage-correct-badge">
                                <CheckCircle2 size={16} /> Correct
                              </span>
                            )}
                          </div>
                          <div className="stage-poll-option-stats">
                            <strong>{opt.percentage || 0}%</strong>
                            <span>({opt.votes || 0} votes)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="stage-poll-footer">
                  <span>Total Responses: <strong>{activePoll.totalVotes || 0}</strong></span>
                  <span>Scan QR code to cast your vote</span>
                </div>
              </div>
            ) : (
              <div className="stage-poll-card" style={{ textAlign: "center", alignItems: "center" }}>
                <div style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  color: "var(--stage-accent, #3B82F6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}>
                  <BarChart3 size={30} />
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>Live Audience Poll</h2>
                <p style={{ fontSize: 15, opacity: 0.7, maxWidth: 440, margin: "0 0 20px", lineHeight: 1.5 }}>
                  No poll is currently active. Launch a multiple-choice poll or quiz from your host dashboard to display live results.
                </p>
              </div>
            )
          )}

          {/* TAB 3: LIVE AUDIENCE WORD CLOUD */}
          {activeTab === "wordcloud" && (
            <div className="stage-poll-card">
              <div className="stage-poll-badge">
                <Cloud size={16} />
                <span>Live Audience Word Cloud</span>
                {activePoll?.type === "WORD_CLOUD" && (
                  <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8, textTransform: "none" }}>
                    {activePoll.totalVotes || 0} submissions
                  </span>
                )}
              </div>

              <h2 className="stage-poll-question">
                {activePoll?.type === "WORD_CLOUD" ? activePoll.question : "Live Word Cloud Visualizer"}
              </h2>

              <div className="stage-wordcloud-box">
                <WordCloudVisualizer
                  words={activePoll?.type === "WORD_CLOUD" ? (activePoll.wordCloud || []) : []}
                  isDark={stageTheme !== "light"}
                  minHeight={340}
                />
              </div>

              <div className="stage-poll-footer">
                <span>Dynamic real-time frequency clustering</span>
                <span>Scan QR code on the right to submit words</span>
              </div>
            </div>
          )}
        </section>

        {/* Right Side: Sticky Audience QR Join Station */}
        <aside className="stage-qr-sidebar">
          <div className="stage-qr-box">
            <div className="stage-qr-header">
              <span className="stage-qr-whispr-tag">
                <img src="/Logo Bgless.png" alt="WhisprLive" style={{ width: 14, height: 14, objectFit: "contain" }} />
                <span>WhisprLive Live Join</span>
              </span>
              <span className="stage-qr-eyebrow">
                <QrCode size={13} /> Scan from Phone
              </span>
            </div>
            <div className="stage-qr-image-wrapper">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR code to join room ${joinSlug}`} className="stage-qr-image" />
              ) : (
                <div className="stage-qr-placeholder" />
              )}
            </div>
            <div className="stage-qr-instructions">
              <p>Point camera to join & participate</p>
              <div className="stage-qr-code-pill">
                whisprlive.live/ask/<strong>{joinSlug}</strong>
              </div>
              <span className="stage-qr-subtext">No app install · 100% Free & Anonymous</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Stage Watermark & Status Footer */}
      <footer className="stage-bottom-bar">
        <div className="stage-bottom-brand">
          <img src="/Logo Bgless.png" alt="WhisprLive" style={{ width: 18, height: 18, objectFit: "contain" }} />
          <span>Powered by <strong>WhisprLive</strong> · Interactive Audience Intelligence</span>
        </div>
        <div className="stage-status-indicator">
          <span className="stage-pulse-dot" /> Live Stage Active
        </div>
        <div className="stage-shortcut-hint">
          Press <strong>F</strong> for Fullscreen
        </div>
      </footer>
    </div>
  );
}
