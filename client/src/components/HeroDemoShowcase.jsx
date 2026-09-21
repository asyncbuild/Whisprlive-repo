import React, { useState, useEffect, useRef } from "react";
import {
  Play, Pause, RotateCcw, Send, ThumbsUp, Radio,
  QrCode, Check, BarChart2, Sparkles, Pin, ShieldCheck,
  User, LogOut, Copy, Crown, Clock, CheckCircle2, ChevronRight, MessageSquare, Zap, ArrowRight, Share2
} from "lucide-react";

const DEMO_STEPS = [
  { id: "dashboard", label: "Dashboard", icon: Zap, mode: "host" },
  { id: "audience-join", label: "QR Join", icon: QrCode, mode: "audience" },
  { id: "live-qa", label: "Live Q&A", icon: MessageSquare, mode: "audience" },
  { id: "live-poll", label: "Live Polls", icon: BarChart2, mode: "audience" },
  { id: "spotlight", label: "Spotlight", icon: Pin, mode: "host" }
];

export default function HeroDemoShowcase() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [typedQuestion, setTypedQuestion] = useState("");
  const [sentQuestion, setSentQuestion] = useState(false);
  const [selectedPollOpt, setSelectedPollOpt] = useState(null);
  const [upvoteCount, setUpvoteCount] = useState(84);
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50, active: false, visible: false });
  const [stepProgress, setStepProgress] = useState(0);

  const stepDuration = 5600;
  const progressTimerRef = useRef(null);

  // Auto-play orchestration
  useEffect(() => {
    if (!isPlaying) return;

    setStepProgress(0);
    const startTime = Date.now();

    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / stepDuration) * 100, 100);
      setStepProgress(progress);

      if (elapsed >= stepDuration) {
        clearInterval(progressTimerRef.current);
        setCurrentStepIndex((prev) => (prev + 1) % DEMO_STEPS.length);
      }
    }, 40);

    return () => clearInterval(progressTimerRef.current);
  }, [currentStepIndex, isPlaying]);

  // Scene-specific choreographed pointer animations
  useEffect(() => {
    const step = DEMO_STEPS[currentStepIndex].id;

    if (step === "dashboard") {
      setCursorPos({ x: 78, y: 44, visible: true, active: false });
      const t1 = setTimeout(() => setCursorPos({ x: 78, y: 44, visible: true, active: true }), 1300);
      const t2 = setTimeout(() => setCursorPos({ x: 50, y: 50, visible: false, active: false }), 2400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    if (step === "audience-join") {
      setCursorPos({ x: 50, y: 82, visible: true, active: false });
      const t1 = setTimeout(() => setCursorPos({ x: 50, y: 82, visible: true, active: true }), 1500);
      const t2 = setTimeout(() => setCursorPos({ x: 50, y: 50, visible: false, active: false }), 2600);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    if (step === "live-qa") {
      const text = "How does WhisprLive scale with 1,000+ people?";
      setTypedQuestion("");
      setSentQuestion(false);
      setIsUpvoted(false);
      setUpvoteCount(84);

      let idx = 0;
      const typer = setInterval(() => {
        if (idx <= text.length) {
          setTypedQuestion(text.slice(0, idx));
          idx++;
        } else {
          clearInterval(typer);
        }
      }, 30);

      const t1 = setTimeout(() => {
        setCursorPos({ x: 86, y: 52, visible: true, active: true });
        setSentQuestion(true);
      }, 1900);

      const t2 = setTimeout(() => {
        setCursorPos({ x: 86, y: 78, visible: true, active: true });
        setIsUpvoted(true);
        setUpvoteCount(85);
      }, 3400);

      const t3 = setTimeout(() => setCursorPos({ x: 50, y: 50, visible: false, active: false }), 4600);

      return () => {
        clearInterval(typer);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    if (step === "live-poll") {
      setSelectedPollOpt(null);
      setCursorPos({ x: 50, y: 46, visible: true, active: false });
      const t1 = setTimeout(() => {
        setCursorPos({ x: 50, y: 46, visible: true, active: true });
        setSelectedPollOpt("csv");
      }, 1300);
      const t2 = setTimeout(() => setCursorPos({ x: 50, y: 50, visible: false, active: false }), 2600);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    if (step === "spotlight") {
      setIsPinned(false);
      setCursorPos({ x: 88, y: 64, visible: true, active: false });
      const t1 = setTimeout(() => {
        setCursorPos({ x: 88, y: 64, visible: true, active: true });
        setIsPinned(true);
      }, 1400);
      const t2 = setTimeout(() => setCursorPos({ x: 50, y: 50, visible: false, active: false }), 2700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [currentStepIndex]);

  const activeStep = DEMO_STEPS[currentStepIndex];

  return (
    <div className="demo-showcase-container">
      {/* Top Feature Selector Underline Tabs */}
      <div className="demo-tabs-nav">
        {DEMO_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentStepIndex;
          return (
            <button
              key={step.id}
              type="button"
              className={`demo-tab ${isActive ? "active" : ""}`}
              onClick={() => {
                setCurrentStepIndex(idx);
                setStepProgress(0);
              }}
            >
              <Icon size={13} className="demo-tab-icon" />
              <span className="demo-tab-text">{step.label}</span>
              {isActive && (
                <span className="demo-tab-underline">
                  <span
                    className="demo-tab-progress"
                    style={{ width: `${stepProgress}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Realistic Smartphone Shell */}
      <div className="demo-phone-wrapper">
        <div className="demo-phone-bezel">
          {/* Dynamic Island */}
          <div className="demo-phone-island">
            <div className="island-camera" />
            <div className="island-indicator" />
          </div>

          {/* Status Bar */}
          <div className="demo-phone-status-bar">
            <span className="status-time">9:41</span>
            <div className="status-icons">
              <span className="status-signal">5G</span>
              <div className="status-battery"><div className="status-battery-fill" /></div>
            </div>
          </div>

          {/* Device Screen Viewport */}
          <div className="demo-camera-viewport">
            <div className="demo-camera-stage">

              {/* ------------------------------------------------------------------
                  SCENE 1: REAL HOST DASHBOARD (Exact Match to DashboardPage.jsx)
                  ------------------------------------------------------------------ */}
              {activeStep.id === "dashboard" && (
                <div className="real-demo-screen">
                  {/* Top Dashboard Nav */}
                  <div className="real-dash-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <img src="/Logo Bgless.png" alt="WhisprLive" style={{ width: 18, height: 18, objectFit: "contain" }} />
                      <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "var(--font-display)" }}>
                        Whispr<span style={{ color: "var(--accent)" }}>Live</span>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span
                        className="plan-badge"
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          border: "1px solid var(--border)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          textTransform: "uppercase"
                        }}
                      >
                        <Crown size={10} /> SOLO
                      </span>
                      <div className="user-pill" style={{ padding: "3px 7px", fontSize: 10 }}>
                        <span className="avatar" style={{ width: 16, height: 16, fontSize: 8.5 }}><User size={9} /></span>
                        <span>Alex R.</span>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Head & Underline Tabs */}
                  <div className="real-dash-content">
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)" }}>Sessions</h3>
                      <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>1 Active Session</span>
                    </div>

                    <div className="tabs" style={{ gap: 12, marginBottom: 10 }}>
                      <span className="tab" style={{ fontSize: 11.5, padding: "5px 2px" }}>New</span>
                      <span className="tab active" style={{ fontSize: 11.5, padding: "5px 2px" }}>
                        Active <span className="live-dot" style={{ display: "inline-block", marginLeft: 4 }} />
                      </span>
                      <span className="tab" style={{ fontSize: 11.5, padding: "5px 2px" }}>Past</span>
                      <span className="tab" style={{ fontSize: 11.5, padding: "5px 2px" }}>Polls</span>
                    </div>

                    {/* Active Room Card */}
                    <div className="real-active-room-card">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-display)" }}>
                            Keynote &amp; Product AMA
                          </div>
                          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}>
                            15-min session · Room: <strong style={{ color: "var(--accent)" }}>WHISPR-782</strong>
                          </div>
                        </div>
                        <span className="countdown" style={{ fontSize: 10.5, padding: "3px 7px" }}>
                          <Clock size={11} /> 14:12 remaining
                        </span>
                      </div>

                      {/* Room Code & Link Box */}
                      <div className="link-box" style={{ padding: "7px 9px", margin: "6px 0", fontSize: 11 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                          <div className="qr-box" style={{ width: 22, height: 22, flexShrink: 0, padding: 2 }}>
                            <img src="/Logo Bgless.png" alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                          <span className="url" style={{ fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            whisprlive.com/ask/WHISPR-782
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <span className="btn btn-soft btn-sm" style={{ padding: "3px 6px", fontSize: 9.5 }}>
                            <Copy size={9} /> Copy
                          </span>
                          <span className="btn btn-primary btn-sm" style={{ padding: "3px 7px", fontSize: 9.5, background: "linear-gradient(135deg, #FF5A36 0%, #EA580C 100%)" }}>
                            <BarChart2 size={9} /> Live Poll 🔴
                          </span>
                        </div>
                      </div>

                      {/* Live Question Bubble Preview with Host Reply */}
                      <div className="bubble" style={{ padding: "8px 10px", marginTop: 6 }}>
                        <div className="bubble-top" style={{ marginBottom: 4 }}>
                          <div className="bubble-meta">
                            <span className="bubble-avatar" style={{ width: 16, height: 16, fontSize: 8.5 }}>G</span>
                            <span>Guest 104</span>
                            <span className="pinned-badge" style={{ fontSize: 9, padding: "1px 5px" }}>
                              <Pin size={8.5} /> Pinned
                            </span>
                          </div>
                          <span className="vote-btn voted" style={{ padding: "2px 6px", fontSize: 9.5 }}>
                            <ThumbsUp size={9.5} /> 84
                          </span>
                        </div>
                        <div className="bubble-text" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                          Will the keynote recording &amp; deck be shared after?
                        </div>
                        <div className="dash-host-reply-box" style={{ marginTop: 6, padding: "5px 8px", fontSize: 10.5 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
                            <Sparkles size={9.5} /> Your Answer to Attendees:
                          </span>
                          <div style={{ color: "var(--text)", lineHeight: 1.35 }}>
                            Yes, full recordings &amp; slides will be emailed to all attendees!
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------
                  SCENE 2: AUDIENCE JOIN VIA QR (Exact Match to PublicAskPage.jsx)
                  ------------------------------------------------------------------ */}
              {activeStep.id === "audience-join" && (
                <div className="real-demo-screen public-screen">
                  <div className="public-card" style={{ padding: "16px 14px", margin: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ textAlign: "center" }}>
                      <span className="eyebrow" style={{ fontSize: 10, padding: "3px 9px", marginBottom: 8 }}>
                        <Radio size={10} /> Live Room Active
                      </span>
                      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "4px 0 2px", fontFamily: "var(--font-display)" }}>
                        Keynote &amp; Product AMA
                      </h2>
                      <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>
                        Share questions &amp; vote 100% anonymously.
                      </p>

                      <div className="timer-badge" style={{ margin: "8px auto 0", fontSize: 10.5, padding: "3px 9px", display: "inline-flex" }}>
                        <Clock size={11} /> <span>14:12 remaining</span>
                      </div>
                    </div>

                    {/* QR Code Graphic Frame */}
                    <div className="branded-scanner-card" style={{ maxWidth: 160, padding: "8px", margin: "8px auto" }}>
                      <div className="branded-scanner-viewport" style={{ width: 124, height: 124, padding: 6 }}>
                        <div className="scanner-corner corner-tl" style={{ width: 10, height: 10 }} />
                        <div className="scanner-corner corner-tr" style={{ width: 10, height: 10 }} />
                        <div className="scanner-corner corner-bl" style={{ width: 10, height: 10 }} />
                        <div className="scanner-corner corner-br" style={{ width: 10, height: 10 }} />
                        <img
                          src="/Logo Bgless.png"
                          alt="WhisprLive"
                          style={{ width: 26, height: 26, position: "absolute", zIndex: 3, background: "#fff", borderRadius: 6, padding: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
                        />
                        <div className="qr-matrix-mock" />
                      </div>
                      <div className="scanner-hud-footer" style={{ marginTop: 4 }}>
                        <span className="scanner-target-hint" style={{ fontSize: 9.5 }}>
                          <QrCode size={10} /> Scan with phone camera
                        </span>
                      </div>
                    </div>

                    <button type="button" className="btn btn-primary btn-block btn-sm" style={{ padding: "9px", fontSize: 12, borderRadius: 999 }}>
                      Join Room Instantly <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------
                  SCENE 3: REAL AUDIENCE LIVE Q&A (Exact Match to PublicAskPage.jsx)
                  ------------------------------------------------------------------ */}
              {activeStep.id === "live-qa" && (
                <div className="real-demo-screen public-screen">
                  <div className="public-card" style={{ padding: "14px 14px", margin: 0, height: "100%", display: "flex", flexDirection: "column" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)" }}>Keynote Q&amp;A</span>
                        <div style={{ fontSize: 9.5, color: "var(--text-dim)" }}>Anonymous Live Room</div>
                      </div>
                      <span className="timer-badge" style={{ fontSize: 10, padding: "2px 7px" }}>
                        <Clock size={10} /> 14:12
                      </span>
                    </div>

                    {/* Segmented Tabs Bar */}
                    <div className="audience-tabs-bar" style={{ marginBottom: 8, padding: 2 }}>
                      <button type="button" className="audience-tab-btn active" style={{ padding: "5px 7px", fontSize: 10.5 }}>
                        <Send size={10} /> Ask
                      </button>
                      <button type="button" className="audience-tab-btn" style={{ padding: "5px 7px", fontSize: 10.5 }}>
                        <MessageSquare size={10} /> Q&amp;A Feed (4)
                      </button>
                      <button type="button" className="audience-tab-btn" style={{ padding: "5px 7px", fontSize: 10.5 }}>
                        <BarChart2 size={10} /> Poll (1)
                      </button>
                    </div>

                    {/* Real Ask Form */}
                    <div className="ask-box" style={{ padding: "9px 11px", marginBottom: 8 }}>
                      <div className="ask-textarea" style={{ minHeight: 46, fontSize: 11, color: typedQuestion ? "var(--text)" : "var(--text-faint)" }}>
                        {typedQuestion || "Share an anonymous question..."}
                        {typedQuestion && !sentQuestion && <span className="caret" />}
                      </div>
                      <div className="ask-foot" style={{ marginTop: 4, paddingTop: 4 }}>
                        <span className="char-count mono" style={{ fontSize: 9.5 }}>{typedQuestion.length}/300</span>
                        <button type="button" className="btn btn-primary btn-sm" style={{ padding: "3px 9px", fontSize: 10.5 }}>
                          Send <Send size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Sent Alert & Live Feed */}
                    {sentQuestion && (
                      <div className="sent-toast" style={{ padding: "5px 9px", fontSize: 10.5, marginBottom: 6 }}>
                        <Check size={11} /> Sent! Live on host screen.
                      </div>
                    )}

                    <div className="bubble" style={{ padding: "8px 10px", marginTop: "auto" }}>
                      <div className="bubble-top" style={{ marginBottom: 3 }}>
                        <div className="bubble-meta">
                          <span className="bubble-avatar" style={{ width: 16, height: 16, fontSize: 8.5 }}>G</span>
                          <span style={{ fontSize: 10 }}>You (Guest 88) · Just now</span>
                        </div>
                        <span className={`vote-btn ${isUpvoted ? "voted" : ""}`} style={{ padding: "2px 6px", fontSize: 9.5 }}>
                          <ThumbsUp size={9.5} /> {upvoteCount}
                        </span>
                      </div>
                      <div className="bubble-text" style={{ fontSize: 11, lineHeight: 1.35 }}>
                        {typedQuestion || "How does WhisprLive scale with 1,000+ people?"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------
                  SCENE 4: REAL LIVE AUDIENCE POLL (Exact Match to PublicAskPage.jsx)
                  ------------------------------------------------------------------ */}
              {activeStep.id === "live-poll" && (
                <div className="real-demo-screen public-screen">
                  <div className="public-card" style={{ padding: "14px 14px", margin: 0, height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span className="live-badge" style={{ fontSize: 10 }}>
                        <span className="live-dot" /> LIVE POLL
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>142 Responses</span>
                    </div>

                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: "var(--text)", fontFamily: "var(--font-display)" }}>
                      Which feature would you use most?
                    </h4>

                    {/* Real Poll Options */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                      <div
                        className="poll-opt-card"
                        style={{
                          padding: "8px 10px",
                          border: selectedPollOpt === "csv" ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                          background: selectedPollOpt === "csv" ? "var(--accent-soft)" : "var(--surface-2)",
                          borderRadius: 8
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>
                          <span style={{ color: "var(--text)" }}>Instant CSV Export</span>
                          <span style={{ color: "var(--accent)" }}>{selectedPollOpt === "csv" ? "68% (96)" : "62%"}</span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: selectedPollOpt === "csv" ? "68%" : "62%", background: "linear-gradient(90deg, #2563EB 0%, #3B82F6 100%)", borderRadius: 999, transition: "width 0.5s ease" }} />
                        </div>
                      </div>

                      <div className="poll-opt-card" style={{ padding: "8px 10px", border: "1px solid var(--border)", background: "var(--surface-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>
                          <span style={{ color: "var(--text)" }}>Word Cloud Visualizer</span>
                          <span style={{ color: "var(--text-dim)" }}>24% (34)</span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: "24%", background: "linear-gradient(90deg, #8B5CF6 0%, #A855F7 100%)", borderRadius: 999 }} />
                        </div>
                      </div>

                      <div className="poll-opt-card" style={{ padding: "8px 10px", border: "1px solid var(--border)", background: "var(--surface-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>
                          <span style={{ color: "var(--text)" }}>Custom Host Branding</span>
                          <span style={{ color: "var(--text-dim)" }}>8% (12)</span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: "8%", background: "var(--text-faint)", borderRadius: 999 }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--success)", fontWeight: 600, marginTop: "auto", paddingTop: 4 }}>
                      <CheckCircle2 size={11} /> Response recorded in real-time
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------
                  SCENE 5: HOST QUESTION SPOTLIGHT & WORD CLOUD
                  ------------------------------------------------------------------ */}
              {activeStep.id === "spotlight" && (
                <div className="real-demo-screen">
                  <div className="real-dash-top" style={{ paddingBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span className="live-dot" />
                      <strong style={{ fontSize: 11.5, fontFamily: "var(--font-display)" }}>Stage Spotlight</strong>
                    </div>
                    <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700 }}>
                      PROJECTOR VIEW
                    </span>
                  </div>

                  <div className="real-dash-content">
                    {/* Word Cloud Visualizer Box */}
                    <div className="mini-cloud-stage" style={{ height: 115, marginBottom: 8 }}>
                      <span className="cloud-tag tag-giant tag-primary">Real-time</span>
                      <span className="cloud-tag tag-huge tag-cyan">Fast</span>
                      <span className="cloud-tag tag-large tag-indigo">Anonymous</span>
                      <span className="cloud-tag tag-medium tag-purple">Seamless</span>
                      <span className="cloud-tag tag-small tag-emerald">Interactive</span>
                      <span className="cloud-tag tag-large tag-rose">Engaging</span>
                      <span className="cloud-tag tag-medium tag-amber">No App</span>
                    </div>

                    {/* Spotlight Question Card */}
                    <div
                      className="bubble"
                      style={{
                        padding: "9px 11px",
                        borderLeft: isPinned ? "4px solid #F59E0B" : "1px solid var(--border)",
                        background: isPinned ? "rgba(245, 158, 11, 0.08)" : "var(--surface)",
                        boxShadow: isPinned ? "0 4px 16px rgba(245, 158, 11, 0.18)" : undefined,
                        transition: "all 0.3s ease"
                      }}
                    >
                      <div className="bubble-top" style={{ marginBottom: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#D97706", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <Pin size={9.5} /> {isPinned ? "PINNED TO PROJECTOR" : "TOP VOTED"}
                          </span>
                        </div>
                        <span className="vote-btn voted" style={{ padding: "2px 6px", fontSize: 9.5 }}>
                          <ThumbsUp size={9.5} /> 96
                        </span>
                      </div>
                      <div className="bubble-text" style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.35 }}>
                        Can speakers highlight questions on stage in real time?
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Virtual Touch Pointer with Animated Click Ripple */}
            {cursorPos.visible && (
              <div
                className={`demo-virtual-cursor ${cursorPos.active ? "clicked" : ""}`}
                style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
              >
                <div className="cursor-dot" />
                <div className="cursor-ripple" />
              </div>
            )}
          </div>

          {/* Phone Bottom Gesture Chin */}
          <div className="demo-phone-chin">
            <div className="home-indicator" />
          </div>
        </div>
      </div>
    </div>
  );
}
