import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Maximize2, Minimize2, Radio, QrCode, Sparkles, MessageSquare, BarChart3,
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

    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 440;
      canvas.height = 440;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(rawQr);

      const qrImg = new Image();
      const logoImg = new Image();

      let qrLoaded = false;
      let logoLoaded = false;

      const composite = () => {
        if (!qrLoaded) return;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 440, 440);

        if (logoLoaded && logoImg.width && logoImg.height) {
          ctx.save();
          ctx.globalAlpha = 0.38;
          const maxDim = 360;
          let drawW = maxDim;
          let drawH = maxDim;
          const aspect = logoImg.width / logoImg.height;
          if (aspect > 1) {
            drawW = maxDim;
            drawH = maxDim / aspect;
          } else {
            drawH = maxDim;
            drawW = maxDim * aspect;
          }
          const drawX = (440 - drawW) / 2;
          const drawY = (440 - drawH) / 2;
          ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
          ctx.restore();
        }

        ctx.drawImage(qrImg, 0, 0, 440, 440);
        resolve(canvas.toDataURL("image/png"));
      };

      qrImg.onload = () => { qrLoaded = true; composite(); };
      qrImg.onerror = () => resolve(rawQr);

      logoImg.onload = () => { logoLoaded = true; composite(); };
      logoImg.onerror = () => { logoLoaded = false; composite(); };

      qrImg.src = rawQr;
      logoImg.src = brandLogo || "/Logo Bgless.png";
    });
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
  const [activeTab, setActiveTab] = useState("auto"); // "auto" | "spotlight" | "poll" | "feed"
  const [spotlightMessageId, setSpotlightMessageId] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageTheme, setStageTheme] = useState("dark"); // "dark" | "light" | "midnight"
  const [quizRevealedData, setQuizRevealedData] = useState(null);

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

  // Auto mode determination
  const effectiveViewMode = useMemo(() => {
    if (activeTab !== "auto") return activeTab;
    if (activePoll && activePoll.isActive) return "poll";
    if (spotlightQuestion) return "spotlight";
    return "feed";
  }, [activeTab, activePoll, spotlightQuestion]);

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
          {room?.brandLogo ? (
            <img src={room.brandLogo} alt="Event Logo" className="stage-custom-logo" />
          ) : (
            <div className="stage-whispr-badge">
              <span className="stage-live-dot" />
              <strong>WhisprLive</strong> Stage
            </div>
          )}
          <h1 className="stage-room-title">{room?.title || "Live Q&A Session"}</h1>
        </div>

        {/* Stage View Mode Toggles & Controls */}
        <div className="stage-controls">
          <div className="stage-mode-pill-group">
            <button
              className={`stage-mode-pill ${activeTab === "auto" ? "is-active" : ""}`}
              onClick={() => setActiveTab("auto")}
              title="Auto switch between polls and spotlight"
            >
              <Sparkles size={14} /> Auto
            </button>
            <button
              className={`stage-mode-pill ${activeTab === "spotlight" ? "is-active" : ""}`}
              onClick={() => setActiveTab("spotlight")}
              title="Spotlight active question"
            >
              <MessageSquare size={14} /> Spotlight
            </button>
            {activePoll && (
              <button
                className={`stage-mode-pill ${activeTab === "poll" ? "is-active" : ""}`}
                onClick={() => setActiveTab("poll")}
                title="Live Poll & Results"
              >
                <BarChart3 size={14} /> Live Poll
              </button>
            )}
            <button
              className={`stage-mode-pill ${activeTab === "feed" ? "is-active" : ""}`}
              onClick={() => setActiveTab("feed")}
              title="Live Questions Feed"
            >
              Questions ({messages.length})
            </button>
          </div>

          <button
            className="stage-icon-btn"
            onClick={() => setStageTheme((t) => (t === "dark" ? "midnight" : t === "midnight" ? "light" : "dark"))}
            title="Toggle Stage Theme"
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
          {effectiveViewMode === "poll" && activePoll ? (
            <div className="stage-poll-card">
              <div className="stage-poll-badge">
                <BarChart3 size={16} />
                <span>
                  {activePoll.isQuiz
                    ? "Live Audience Quiz"
                    : activePoll.type === "WORD_CLOUD"
                    ? "Live Dynamic Word Cloud"
                    : "Live Audience Poll"}
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

              {activePoll.type === "WORD_CLOUD" ? (
                <div className="stage-wordcloud-box">
                  <WordCloudVisualizer wordCloud={activePoll.wordCloud || []} />
                </div>
              ) : (
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
              )}

              <div className="stage-poll-footer">
                <span>Total Responses: <strong>{activePoll.totalVotes || 0}</strong></span>
                <span>Scan QR code on the right to participate live</span>
              </div>
            </div>
          ) : effectiveViewMode === "spotlight" && spotlightQuestion ? (
            <div className="stage-spotlight-card">
              <div className="stage-spotlight-top">
                <div className="stage-spotlight-badge">
                  <Radio size={14} className="stage-live-pulse" />
                  <span>{spotlightQuestion.isPinned ? "📌 Pinned Question" : "🔥 Live Question Spotlight"}</span>
                </div>
                <div className="stage-spotlight-upvotes">
                  <span>▲</span>
                  <strong>{spotlightQuestion.upvotes || 0}</strong>
                  <small>upvotes</small>
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
                <span>Submitted anonymously by participant</span>
                {messages.length > 1 && (
                  <div className="stage-spotlight-nav">
                    <span>Use host controls to spotlight questions</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="stage-feed-view">
              <div className="stage-feed-head">
                <h2>Live Question Stream ({messages.length})</h2>
                <span>Real-time audience submissions</span>
              </div>
              <div className="stage-feed-grid">
                {messages.slice(0, 12).map((m, i) => (
                  <div
                    key={m.id || i}
                    className={`stage-feed-item ${m.isPinned ? "is-pinned" : ""} ${m.isAnswered ? "is-answered" : ""}`}
                    onClick={() => {
                      setSpotlightMessageId(m.id);
                      setActiveTab("spotlight");
                    }}
                  >
                    <div className="stage-feed-item-top">
                      <span className="stage-feed-upvote-chip">▲ {m.upvotes || 0}</span>
                      {m.isPinned && <span className="stage-feed-pinned-badge">Pinned</span>}
                      {m.isAnswered && <span className="stage-feed-answered-badge">Answered</span>}
                    </div>
                    <p className="stage-feed-item-text">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Side: Sticky Audience QR Join Station */}
        <aside className="stage-qr-sidebar">
          <div className="stage-qr-box">
            <span className="stage-qr-eyebrow">
              <QrCode size={14} /> Join from your phone
            </span>
            <div className="stage-qr-image-wrapper">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR code to join room ${joinSlug}`} className="stage-qr-image" />
              ) : (
                <div className="stage-qr-placeholder" />
              )}
            </div>
            <div className="stage-qr-instructions">
              <p>Point phone camera to scan</p>
              <div className="stage-qr-code-pill">
                whisprlive.com/ask/<strong>{joinSlug}</strong>
              </div>
              <span className="stage-qr-subtext">No download · No sign-in needed</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Stage Watermark Footer */}
      <footer className="stage-bottom-bar">
        {room?.showWatermark ? (
          <div className="stage-watermark">
            <span>⚡ Powered by <strong>WhisprLive</strong></span>
          </div>
        ) : (
          <div />
        )}
        <div className="stage-status-indicator">
          <span className="stage-pulse-dot" /> Live Room Active
        </div>
      </footer>
    </div>
  );
}
