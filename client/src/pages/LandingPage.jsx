import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Check, Radio, Bell, Loader2, ShieldCheck,
  Smartphone, Users, MessageCircle, ChevronDown, BarChart2, Tv, Sparkles, Trophy,
  Download, Palette, Lock, CheckCircle2, MessageSquare, Layers, Globe, Calendar, Flame, Share2, X
} from "lucide-react";
import QRCode from "qrcode";
import API from "../api/axios";
import Brand from "../components/Brand";
import HeroDemoShowcase from "../components/HeroDemoShowcase";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useGeoCurrency } from "../utils/geoCurrency";

const FAQ_ITEMS = [
  {
    question: "Is WhisprLive 100% anonymous for audience members?",
    answer: "Yes. Attendees submit questions and vote without creating accounts, logging in, or sharing personal data. They join in 0 seconds simply by scanning your event's QR code or clicking your room link.",
  },
  {
    question: "How does the Projector Stage View work at events and conferences?",
    answer: "WhisprLive includes a dedicated Projector Stage View (/stage/:code) designed for big screens and LED walls. It lets you toggle between real-time Q&A stream/spotlight, live poll results, and dynamic word clouds, complete with attendee floating reactions and customized event branding.",
  },
  {
    question: "Can I run Live Quizzes, Polls, and Word Clouds in the same session?",
    answer: "Yes! Hosts can launch multiple-choice polls, real-time Word Clouds, and Live Quizzes with countdown timers and synchronized answer reveals. You can also save poll templates to your Poll Library to reuse across multiple events.",
  },
  {
    question: "How does AI multilingual abusive flagging and topic clustering work?",
    answer: "Exclusive to the Studio plan, WhisprLive includes Groq-powered AI Multilingual Abusive Flagging to automatically detect profanity, harassment, and toxic language across all languages and dialects. Studio plans also provide AI Semantic Topic Clustering to group questions and AI Executive Sentiment Summaries.",
  },
  {
    question: "What payment options are available for 24-hour Event Passes and plans?",
    answer: "WhisprLive supports one-time 24-hour Room Passes (no recurring subscription) as well as monthly and annual plans. For hosts in India, we support UPI (Google Pay, PhonePe, Paytm), netbanking, and all major debit/credit cards with instant activation.",
  },
  {
    question: "Can I customize the room URL and display our company / event logo?",
    answer: "Yes. Host and Studio plans let you set custom vanity URLs (e.g. /ask/your-event). Studio plan unlocks custom branding, embedding your organization or sponsor logo directly onto the audience QR scanner and Stage projector display.",
  },
  {
    question: "Can multiple team members moderate the live question feed together?",
    answer: "Yes! With Room Passes, Host, and Studio plans, you can invite co-hosts and moderators by email. They can pin questions, mark answers, filter spam, and launch polls in real time from their own laptops or tablets.",
  },
  {
    question: "How is WhisprLive different from Slido, Mentimeter, and Kahoot?",
    answer: "WhisprLive is designed for zero participant friction and affordable pay-per-event pricing. Unlike tools that require expensive recurring subscriptions, WhisprLive lets organizers activate single 24-hour room passes using UPI (Google Pay, PhonePe, Paytm) or cards. Attendees never need an app or account to ask questions, vote on live polls, see word clouds, or join timed quizzes.",
  },
  {
    question: "What formats can I export session data in after the event?",
    answer: "You can export audience questions, upvotes, and poll results in Plain Text (.txt), CSV spreadsheet (.csv for Excel and Google Sheets), structured JSON (.json), or ready-to-print branded PDF Executive Summary reports (.pdf).",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const isLoggedIn = Boolean(token);
  const geoCurrency = useGeoCurrency();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState("HOST");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [displayTotal, setDisplayTotal] = useState("...");
  const [demoQr, setDemoQr] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [pricingBillingCycle, setPricingBillingCycle] = useState("YEARLY");

  const homeRef = useRef(null);
  const aboutRef = useRef(null);
  const featuresRef = useRef(null);
  const pricingRef = useRef(null);
  const liveMockRef = useRef(null);

  useEffect(() => {
    if (showWaitlistModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showWaitlistModal]);

  useEffect(() => {
    document.title = "WhisprLive | Real-time Anonymous Live Q&A, Polls, Quizzes & Stage Projector";
    const description = "Real-time anonymous live Q&A, interactive polls, word clouds, live quizzes, and dedicated projector stage views for events, town halls, and conferences. Instant QR access.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;

    // Generate high-contrast clean centered logo badge for demo QR
    const targetUrl = `${window.location.origin}/ask/demo`;
    QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 440,
      color: { dark: "#0f172a", light: "#ffffff" }
    })
      .then((qrData) => {
        const qrImg = new Image();
        const logoImg = new Image();

        const loadImg = (img, src) =>
          new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
          });

        Promise.all([
          loadImg(qrImg, qrData),
          loadImg(logoImg, "/Logo Bgless.png")
        ]).then(([qrOk, logoOk]) => {
          if (!qrOk) {
            setDemoQr(qrData);
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = 440;
          canvas.height = 440;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setDemoQr(qrData);
            return;
          }

          // 1. Clean white background
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, 440, 440);
          ctx.drawImage(qrImg, 0, 0, 440, 440);

          // 2. High-contrast centered logo badge
          if (logoOk && logoImg.width && logoImg.height) {
            const badgeSize = 88;
            const bx = (440 - badgeSize) / 2;
            const by = (440 - badgeSize) / 2;

            ctx.save();
            ctx.fillStyle = "#FFFFFF";
            ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
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

          setDemoQr(canvas.toDataURL("image/png"));
        });
      })
      .catch(() => setDemoQr(""));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(() => {
      if (isMounted) {
        const rand = Math.floor(12 + Math.random() * 470);
        setDisplayTotal(rand.toLocaleString());
      }
    }, 45);

    API.get("/api/stats")
      .then((res) => {
        if (isMounted) {
          clearInterval(interval);
          const finalTotal = res.data?.formattedTotal ?? (res.data?.totalSessions !== undefined ? res.data.totalSessions.toLocaleString() : "0");
          setDisplayTotal(finalTotal);
        }
      })
      .catch(() => {
        if (isMounted) {
          clearInterval(interval);
          setDisplayTotal("0");
        }
      });

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const openWaitlist = (planName) => {
    setWaitlistPlan(planName);
    setWaitlistEmail(user?.email || "");
    setShowWaitlistModal(true);
  };

  const handleWaitlistSubmit = async (e) => {
    e?.preventDefault();
    const cleanEmail = waitlistEmail.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSubmittingWaitlist(true);
    try {
      const res = await API.post("/api/waitlist", { email: cleanEmail, plan: waitlistPlan });
      toast.success(res.data?.message || "🎉 You've been added to the waitlist!");
      setShowWaitlistModal(false);
      setWaitlistEmail("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to join waitlist. Please try again.");
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  const handleJoinRoom = (e) => {
    e?.preventDefault();
    const clean = joinCode.trim();
    if (!clean) return;
    const extracted = clean.includes("/ask/") ? clean.split("/ask/")[1]?.trim() : clean;
    navigate(`/ask/${extracted}`);
  };

  const scrollTo = (key) => {
    setMenuOpen(false);
    const targetMap = { home: homeRef, about: aboutRef, features: featuresRef, pricing: pricingRef, liveMock: liveMockRef };
    const target = targetMap[key]?.current;
    if (!target) return;

    if (key === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Measure total sticky headers height (Navbar + Subnav Join Bar on mobile)
    const navEl = document.querySelector(".nav");
    const subnavEl = document.querySelector(".subnav-join-bar");
    let totalHeaderHeight = (navEl?.offsetHeight || 72);
    if (window.innerWidth <= 960 && subnavEl) {
      totalHeaderHeight += (subnavEl.offsetHeight || 56);
    }
    // Add extra breathing space so section title sits comfortably below the header
    const offset = totalHeaderHeight + 16;

    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = target.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: "smooth"
    });
  };

  const handleCheckout = async (planType = "ROOM_PASS") => {
    if (planType === "SOLO") {
      navigate(isLoggedIn ? "/dashboard" : "/signup");
      return;
    }

    const currentToken = localStorage.getItem('whisprlive_token');
    if (!currentToken) {
      toast.info('Please sign in or create an account first.');
      navigate("/signin");
      return;
    }

    const isYearly = pricingBillingCycle === "YEARLY";
    const targetCycle = planType === "ROOM_PASS" ? "ONETIME" : pricingBillingCycle;

    setLoadingPlan(planType);
    try {
      const res = await API.post("/api/payments/razorpay/create-order", { 
        planType, 
        billingCycle: targetCycle,
        currency: geoCurrency.code 
      });
      const { orderId, amount, currency, keyId } = res.data;

      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "WhisprLive",
        description: planType === "ROOM_PASS" 
          ? "24-Hour Room Pass" 
          : `${planType} Plan (${isYearly ? "1 Year" : "1 Month"})`,
        image: `${window.location.origin}/Logo Bgless.png`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const verifyRes = await API.post("/api/payments/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType,
              billingCycle: targetCycle,
            });

            if (verifyRes.data?.user) {
              localStorage.setItem('whisprlive_user', JSON.stringify(verifyRes.data.user));
              if (refreshUser) refreshUser();
            }
            toast.success(verifyRes.data?.message || "Payment successful!");
            navigate("/dashboard");
          } catch (err) {
            toast.error(err.response?.data?.message || "Signature verification failed");
          } finally {
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          }
        },
        prefill: {
          name: user?.username || "Guest User",
          email: user?.email || "test@whisprlive.com",
          contact: "9876543210",
        },
        theme: {
          color: "#2563eb",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      setLoadingPlan(null);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to initiate payment");
    }
  };

  return (
    <div>
      <nav className="nav">
        <div className="container nav-inner">
          <Brand onClick={() => scrollTo("home")} />
          <div className="nav-links">
            <a className="nav-link" onClick={() => scrollTo("home")}>Home</a>
            <a className="nav-link" onClick={() => scrollTo("about")}>About</a>
            <a className="nav-link" onClick={() => scrollTo("features")}>Features</a>
            <a className="nav-link" onClick={() => scrollTo("pricing")}>Pricing</a>
          </div>
          <div className="nav-actions">
            {/* Desktop Quick Room Code Join Input */}
            <form onSubmit={handleJoinRoom} className="nav-join-form nav-hide-mobile" title="Join a live Q&A room by code">
              <div className="nav-join-input-wrap">
                <Radio size={12} className="nav-join-live-dot" />
                <input
                  type="text"
                  placeholder="Enter room code..."
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="nav-join-input"
                  aria-label="Enter room code to join"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-sm nav-join-btn"
                disabled={!joinCode.trim()}
              >
                Join <ArrowRight size={13} />
              </button>
            </form>

            <ThemeToggle className="nav-hide-mobile" />
            {isLoggedIn ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate("/dashboard")}>
                Go to app <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm nav-hide-mobile" onClick={() => navigate("/signin")}>Sign in</button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/signup")}>Get started</button>
              </>
            )}
            <button
              className={`icon-btn nav-menu-btn ${menuOpen ? "is-open" : ""}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              <div className="hamburger-icon">
                <span className="hamburger-line line-1" />
                <span className="hamburger-line line-2" />
                <span className="hamburger-line line-3" />
              </div>
            </button>
          </div>
        </div>
        <div className={`mobile-menu-dropdown-wrap ${menuOpen ? "is-open" : ""}`}>
          <div className="container mobile-menu-dropdown">
            <a className="nav-link" onClick={() => scrollTo("home")}>Home</a>
            <a className="nav-link" onClick={() => scrollTo("about")}>About</a>
            <a className="nav-link" onClick={() => scrollTo("features")}>Features</a>
            <a className="nav-link" onClick={() => scrollTo("pricing")}>Pricing</a>
            {isLoggedIn && (
              <a className="nav-link" onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}>Dashboard</a>
            )}
            <div className="mobile-menu-theme-item">
              <ThemeToggle variant="wide-slider" />
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-Navbar Sticky Join Bar for Mobile & Tablet */}
      <div className="subnav-join-bar">
        <div className="container subnav-join-inner">
          <div className="subnav-join-label">
            <Radio size={12} className="subnav-join-icon" />
            <span>Join Room:</span>
          </div>
          <form onSubmit={handleJoinRoom} className="subnav-join-form">
            <input
              type="text"
              placeholder="Enter room code (e.g. 8tVmS0a1)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="subnav-join-input"
              aria-label="Enter room code to join"
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm subnav-join-btn"
              disabled={!joinCode.trim()}
            >
              Join <ArrowRight size={13} />
            </button>
          </form>
        </div>
      </div>

      {/* HERO SECTION */}
      <div ref={homeRef}>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">
                <Radio size={13} /> Live Q&amp;A · Interactive Polls · Live Quizzes · Word Clouds · Stage View
              </span>
              <h1>Engage Your Audience Live. No Downloads. Zero Friction.</h1>
              <p className="hero-sub">
                The modern audience interaction platform for conferences, webinars, college fests, town halls, and live streams. Attendees scan a QR code to ask anonymous questions, vote on live polls &amp; quizzes, and send real-time floating reactions.
              </p>
              <div className="hero-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(isLoggedIn ? "/dashboard" : "/signup")}
                >
                  {isLoggedIn ? "Go to Dashboard" : "Start a free session"} <ArrowRight size={16} />
                </button>
                <button className="btn btn-ghost" onClick={() => navigate("/try")}>
                  Try the interactive demo <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="hero-friction-proof">
                <ShieldCheck size={16} /> <strong>Guests join in 0 seconds.</strong> Hosts get a moderated feed &amp; big-screen Stage Projector view.
              </div>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">0s</span>
                  <span className="hero-meta-label">to join via QR, no app</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">{displayTotal}</span>
                  <span className="hero-meta-label">sessions hosted</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">&lt; 50ms</span>
                  <span className="hero-meta-label">real-time updates</span>
                </div>
              </div>
            </div>
            <div ref={liveMockRef} className="hero-demo-stage">
              <HeroDemoShowcase />
              <div className="demo-qr-card">
                <div className="demo-qr-copy">
                  <span className="section-eyebrow">Try it from your phone</span>
                  <strong>Scan to test live room</strong>
                  <span>No account. No app. Just ask.</span>
                </div>
                {demoQr ? <img src={demoQr} alt="QR code to join the WhisprLive demo room" /> : <div className="qr-loading" aria-label="Loading demo QR code" />}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* TRUST STRIP / EVENT TYPES */}
      <section className="trust-strip" aria-label="Supported event types">
        <div className="container trust-strip-inner">
          <span className="trust-label">Made for live moments</span>
          <span><Users size={16} /> Keynotes &amp; Conferences</span>
          <span><MessageCircle size={16} /> Town Halls &amp; AMAs</span>
          <span><Tv size={16} /> College Fests &amp; Lectures</span>
          <span><Smartphone size={16} /> Webinars &amp; Streams</span>
          <span><Trophy size={16} /> Live Quizzes &amp; Workshops</span>
        </div>
      </section>

      {/* ABOUT & USE CASES SECTION */}
      <div ref={aboutRef}>
        <section className="section">
          <div className="container">
            <div className="about-head-grid">
              <div className="section-head" style={{ marginBottom: 0, maxWidth: "100%" }}>
                <span className="section-eyebrow">About WhisprLive</span>
                <h2>Built for events, streams &amp; live engagement.</h2>
                <p>
                  Every WhisprLive session is designed for high-energy participation: create a room in seconds, project the live stage screen, collect honest audience feedback, and export clean reports with zero leftover clutter.
                </p>
              </div>

              <div className="use-case-card-grid">
                <div className="use-case-card">
                  <div className="use-case-badge">🎤 Keynotes &amp; Summits</div>
                  <p>Skip passing physical microphones. Attendees scan the stage QR and ask live questions instantly.</p>
                </div>
                <div className="use-case-card">
                  <div className="use-case-badge">📊 Interactive Polls &amp; Quizzes</div>
                  <p>Run instant multiple choice polls, timed quizzes with answer reveals, and dynamic live word clouds.</p>
                </div>
                <div className="use-case-card">
                  <div className="use-case-badge">💬 Town Halls &amp; All-Hands</div>
                  <p>Enable true anonymous feedback so team members can ask bold, candid questions without fear.</p>
                </div>
                <div className="use-case-card">
                  <div className="use-case-badge">🎓 Classrooms &amp; Workshops</div>
                  <p>Keep students engaged with interactive comprehension checks and barrier-free questions.</p>
                </div>
              </div>
            </div>

            {/* HOW IT WORKS IN 3 STEPS */}
            <div style={{ marginTop: 60 }}>
              <div className="section-head" style={{ marginBottom: 24, textAlign: "center", maxWidth: 640, margin: "0 auto 36px" }}>
                <span className="section-eyebrow">How It Works</span>
                <h2>Effortless audience interaction in 3 simple steps.</h2>
                <p>No downloads, no complex setups, and no participant account friction.</p>
              </div>

              <div className="how-it-works-grid">
                <div className="step-card">
                  <div className="step-num-badge">1</div>
                  <h3>Create or Schedule</h3>
                  <p>Launch an instant disposable room or schedule your session in advance with a custom title and custom vanity URL.</p>
                </div>
                <div className="step-card">
                  <div className="step-num-badge">2</div>
                  <h3>Project &amp; Connect</h3>
                  <p>Display the Projector Stage View on your auditorium screen. Attendees scan the high-contrast QR code on their phone in 0 seconds.</p>
                </div>
                <div className="step-card">
                  <div className="step-num-badge">3</div>
                  <h3>Engage &amp; Export</h3>
                  <p>Answer top-voted questions live, run timed quizzes, see floating emoji reactions, and download full reports in CSV, PDF, or TXT.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* CORE FEATURES 6-CARD GRID */}
      <div ref={featuresRef}>
        <section className="section" style={{ background: "var(--surface-2)" }}>
          <div className="container">
            <div className="section-head" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 48px" }}>
              <span className="section-eyebrow">Powerful Features</span>
              <h2>Everything you need to run unforgettable live sessions.</h2>
              <p>Engineered for speed, privacy, and seamless on-stage presentation.</p>
            </div>

            <div className="feature-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <div className="feature">
                <div className="feature-icon"><MessageCircle size={20} /></div>
                <h3>100% Anonymous Live Q&amp;A</h3>
                <p>Audience members submit questions and upvote in real time without creating an account or logging in. Hosts can spotlight, pin, and answer from one clean dashboard.</p>
              </div>

              <div className="feature">
                <div className="feature-icon"><BarChart2 size={20} /></div>
                <h3>Live Polls, Quizzes &amp; Word Clouds</h3>
                <p>Launch multiple-choice polls with live percentage bars, dynamic real-time word clouds, and interactive Quizzes with countdown timers and synchronized answer reveals.</p>
              </div>

              <div className="feature">
                <div className="feature-icon"><Tv size={20} /></div>
                <h3>Dedicated Projector Stage View</h3>
                <p>Display a stunning big-screen presentation screen (<code style={{ fontSize: 13, color: "var(--accent)" }}>/stage/:code</code>) for stage LED walls with Q&amp;A stream, active poll results, word clouds, and live floating reactions.</p>
              </div>

              <div className="feature">
                <div className="feature-icon"><Sparkles size={20} /></div>
                <h3>AI Topic Clusters &amp; Executive Recaps</h3>
                <p>Automatically deduplicate repetitive questions into semantic topic themes. Includes automated toxicity filtering and post-event audience sentiment analysis.</p>
              </div>

              <div className="feature">
                <div className="feature-icon"><Palette size={20} /></div>
                <h3>Custom Event Branding &amp; URLs</h3>
                <p>Embed your company, conference, or sponsor logo directly onto attendee QR code badges and projector screens, complete with custom vanity room URLs.</p>
              </div>

              <div className="feature">
                <div className="feature-icon"><Download size={20} /></div>
                <h3>Co-hosts &amp; Multi-Format Exports</h3>
                <p>Invite team members to moderate question queues live. Export full session data to Plain Text (.txt), CSV spreadsheet (.csv), structured JSON, or branded executive PDF reports.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* PRICING SECTION */}
      <div ref={pricingRef}>
        <section className="section">
          <div className="container">
            <div className="section-head" style={{ marginBottom: 24, textAlign: "center", maxWidth: 600, margin: "0 auto 28px" }}>
              <span className="section-eyebrow">Simple Pricing</span>
              <h2>Start free. Upgrade when the rooms get bigger.</h2>
              <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginTop: 8 }}>
                Flexible one-off 24-hour event passes or feature-packed monthly and annual plans.
              </p>
            </div>

            {/* Billing Cycle Smooth Animated Toggle */}
            <div className="billing-toggle-wrapper">
              <div className="billing-toggle-container">
                <div className={`billing-toggle-pill ${pricingBillingCycle === "YEARLY" ? "yearly" : "monthly"}`} />
                <button
                  type="button"
                  className={`billing-toggle-btn ${pricingBillingCycle === "MONTHLY" ? "active" : ""}`}
                  onClick={() => setPricingBillingCycle("MONTHLY")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`billing-toggle-btn ${pricingBillingCycle === "YEARLY" ? "active" : ""}`}
                  onClick={() => setPricingBillingCycle("YEARLY")}
                >
                  Yearly <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginLeft: 4 }}>Save 20%</span>
                </button>
              </div>
            </div>

            <div className="pricing-grid">
              {/* Solo Free */}
              <div className="price-card">
                <span className="price-tag" style={{ background: "var(--surface-2)", color: "var(--text-dim)", border: "1px solid var(--border)", boxShadow: "none" }}>Starter</span>
                <div className="price-card-body">
                  <div className="price-plan">Solo (Free)</div>
                  <div className="price-amount-wrap">
                    <span className="price-amount">{geoCurrency.symbol}0</span>
                  </div>
                  <p className="price-subtitle">Forever free · No credit card required</p>
                  <ul className="price-list">
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 100 questions per room</span></li>
                    <li><Check size={14} /> <span><strong>Session Duration:</strong> 15m disposable room</span></li>
                    <li><Check size={14} /> <span><strong>Anonymous Q&amp;A:</strong> Live upvoting feed</span></li>
                    <li><Check size={14} /> <span><strong>Interactive Polls:</strong> Dynamic word clouds</span></li>
                    <li><Check size={14} /> <span><strong>Host Moderation:</strong> Pin questions &amp; replies</span></li>
                    <li><Check size={14} /> <span><strong>Data Export:</strong> Plain text (.txt) transcript</span></li>
                    <li><Check size={14} /> <span><strong>Session Archive:</strong> 7 days cloud retention</span></li>
                    <li><Check size={14} /> <span><strong>Audience Access:</strong> Instant stage QR &amp; link</span></li>
                  </ul>
                </div>
                <button
                  className={`btn ${isLoggedIn ? "btn-ghost" : "btn-primary"} btn-block`}
                  disabled={isLoggedIn}
                  onClick={() => navigate(isLoggedIn ? "/dashboard" : "/signup")}
                >
                  {isLoggedIn ? "Current Free Tier" : "Get Started Free"}
                </button>
              </div>

              {/* 24h Room Pass */}
              <div className="price-card">
                <span className="price-tag">Event Pass</span>
                <div className="price-card-body">
                  <div className="price-plan" style={{ color: "var(--accent)" }}>24h Room Pass</div>
                  <div className="price-amount-wrap">
                    <span className="price-amount">
                      {geoCurrency.formatted}
                    </span>
                    <span style={{ fontSize: "15px", color: "var(--text-dim)", textDecoration: "line-through", fontWeight: 600, opacity: 0.75 }}>
                      {geoCurrency.originalFormatted || (geoCurrency.isIndia ? "₹799" : "$12")}
                    </span>
                  </div>
                  <p className="price-subtitle">One-time pass per event · Single 24h room</p>
                  <ul className="price-list">
                    <li><Check size={14} /> <span><strong>Dedicated Room:</strong> Full 24-hour event pass</span></li>
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 500 questions per room</span></li>
                    <li><Check size={14} /> <span><strong>Live Quiz Mode:</strong> Timers &amp; answer reveal</span></li>
                    <li><Check size={14} /> <span><strong>Poll Library:</strong> Saved draft templates</span></li>
                    <li><Check size={14} /> <span><strong>Projector Stage:</strong> Big-screen presentation</span></li>
                    <li><Check size={14} /> <span><strong>Data Exports:</strong> Full CSV &amp; TXT transcripts</span></li>
                    <li><Check size={14} /> <span><strong>Team Controls:</strong> Co-host &amp; moderator tools</span></li>
                    <li><Check size={14} /> <span><strong>Session Archive:</strong> 30 days history &amp; replay</span></li>
                  </ul>
                </div>
                <button
                  className="btn btn-secondary btn-block"
                  disabled={loadingPlan === "ROOM_PASS"}
                  onClick={() => handleCheckout("ROOM_PASS")}
                >
                  {loadingPlan === "ROOM_PASS" ? <><Loader2 size={14} className="spin" /> Processing...</> : `Buy Pass (${geoCurrency.formatted})`}
                </button>
              </div>

              {/* Host Plan */}
              <div className="price-card featured">
                <span className="price-tag">Most Popular</span>
                <div className="price-card-body">
                  <div className="price-plan" style={{ color: "var(--accent)" }}>Host Plan</div>
                  <div className="price-amount-wrap">
                    <span className="price-amount">
                      {pricingBillingCycle === "YEARLY" 
                        ? (geoCurrency.isIndia ? "₹665/mo" : "$8.25/mo") 
                        : (geoCurrency.isIndia ? "₹799/mo" : "$12/mo")}
                    </span>
                  </div>
                  <p className="price-subtitle">
                    {pricingBillingCycle === "YEARLY" 
                      ? (geoCurrency.isIndia ? "365 days access · 2 mos free (Save 20%)" : "365 days access · 2 mos free (Save 20%)") 
                      : "30 days full access · No auto-debit"}
                  </p>
                  <ul className="price-list">
                    <li><Check size={14} /> <span><strong>Unlimited Rooms:</strong> 60m sessions each</span></li>
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 1,000 questions/room</span></li>
                    <li><Check size={14} /> <span><strong>Custom Vanity URL:</strong> /ask/your-event</span></li>
                    <li><Check size={14} /> <span><strong>Safety Controls:</strong> Fast rule-based filters</span></li>
                    <li><Check size={14} /> <span><strong>Team Seats:</strong> Up to 3 co-hosts/mods</span></li>
                    <li><Check size={14} /> <span><strong>Data Exports:</strong> Structured CSV &amp; JSON</span></li>
                    <li><Check size={14} /> <span><strong>Full Interactivity:</strong> Quizzes, clouds &amp; polls</span></li>
                    <li><Check size={14} /> <span><strong>Priority Support:</strong> 90 days history &amp; SLA</span></li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary btn-block"
                  disabled={loadingPlan === "HOST"}
                  onClick={() => handleCheckout("HOST")}
                >
                  {loadingPlan === "HOST" ? (
                    <><Loader2 size={14} className="spin" /> Processing...</>
                  ) : pricingBillingCycle === "YEARLY" ? (
                    `Upgrade Yearly (${geoCurrency.isIndia ? "₹7,990/yr" : "$99/yr"})`
                  ) : (
                    `Upgrade to Host (${geoCurrency.isIndia ? "₹799/mo" : "$12/mo"})`
                  )}
                </button>
              </div>

              {/* Studio Plan */}
              <div className="price-card">
                <span className="price-tag" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>Scale</span>
                <div className="price-card-body">
                  <div className="price-plan" style={{ color: "var(--accent)" }}>Studio Plan</div>
                  <div className="price-amount-wrap">
                    <span className="price-amount">
                      {pricingBillingCycle === "YEARLY" 
                        ? (geoCurrency.isIndia ? "₹1,249/mo" : "$16.50/mo") 
                        : (geoCurrency.isIndia ? "₹1,499/mo" : "$24/mo")}
                    </span>
                  </div>
                  <p className="price-subtitle">
                    {pricingBillingCycle === "YEARLY" 
                      ? (geoCurrency.isIndia ? "365 days access · 2 mos free (Save 20%)" : "365 days access · 2 mos free (Save 20%)") 
                      : "30 days full access · No auto-debit"}
                  </p>
                  <ul className="price-list">
                    <li><Check size={14} /> <span><strong>Extended Sessions:</strong> Unlimited 120m</span></li>
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 2,500 questions/room</span></li>
                    <li><Check size={14} /> <span><strong>Custom Event Logo:</strong> Stamped on QR &amp; Stage</span></li>
                    <li><Check size={14} /> <span><strong>AI Multilingual Moderation:</strong> Abusive flagging in all languages</span></li>
                    <li><Check size={14} /> <span><strong>AI Topic Clustering:</strong> Deduplication</span></li>
                    <li><Check size={14} /> <span><strong>AI Executive Summary:</strong> Sentiment recap</span></li>
                    <li><Check size={14} /> <span><strong>Unlimited Seats:</strong> Co-hosts &amp; moderators</span></li>
                    <li><Check size={14} /> <span><strong>Executive Reports:</strong> Branded PDF export</span></li>
                  </ul>
                </div>
                <button
                  className="btn btn-secondary btn-block"
                  disabled={loadingPlan === "STUDIO"}
                  onClick={() => handleCheckout("STUDIO")}
                >
                  {loadingPlan === "STUDIO" ? (
                    <><Loader2 size={14} className="spin" /> Processing...</>
                  ) : pricingBillingCycle === "YEARLY" ? (
                    `Get Studio Yearly (${geoCurrency.isIndia ? "₹14,990/yr" : "$199/yr"})`
                  ) : (
                    `Get Studio Plan (${geoCurrency.isIndia ? "₹1,499/mo" : "$24/mo"})`
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* FAQ SECTION */}
      <section className="section faq-section">
        <div className="container">
          <div className="section-head" style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 40px" }}>
            <span className="section-eyebrow">Frequently Asked Questions</span>
            <h2>Everything you need to know about WhisprLive.</h2>
            <p>Keep your audience focused on the presentation. Participants scan, ask, vote, and leave without creating yet another account.</p>
          </div>

          <div className="faq-container">
            <div className="faq-list" aria-label="Frequently asked questions">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div className={`faq-item${isOpen ? " is-open" : ""}`} key={item.question}>
                    <button
                      className="faq-trigger"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </button>
                    {isOpen && <p className="faq-answer">{item.answer}</p>}
                  </div>
                );
              })}
            </div>

            <div className="faq-bottom-cta">
              <p>Still have questions? We're here to help.</p>
              <Link to="/contact" className="btn btn-soft btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                Contact Support <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <Brand onClick={() => scrollTo("home")} />
            <div className="footer-cols">
              <div className="footer-col">
                <h4>Company &amp; Product</h4>
                <Link to="/about">About Us</Link>
                <a onClick={() => scrollTo("features")}>Features</a>
                <a onClick={() => scrollTo("pricing")}>Pricing</a>
                <Link to="/contact">Contact Us</Link>
                <a onClick={() => navigate("/ask/demo")}>Live page example</a>
              </div>
              <div className="footer-col">
                <h4>Legal &amp; Policies</h4>
                <Link to="/terms">Terms &amp; Conditions</Link>
                <Link to="/privacy">Privacy Policy</Link>
                <Link to="/refund">Cancellation &amp; Refund Policy</Link>
              </div>
              <div className="footer-col">
                <h4>Account</h4>
                {isLoggedIn ? (
                  <Link to="/dashboard">Go to App (Dashboard)</Link>
                ) : (
                  <>
                    <Link to="/signin">Sign in</Link>
                    <Link to="/signup">Create account</Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 WhisprLive. All rooms close eventually.</span>
            <span className="mono">Made for live rooms</span>
          </div>
        </div>
      </footer>

      {/* Plan Waitlist Modal Popup */}
      {showWaitlistModal && (
        <div className="modal-overlay" onClick={() => setShowWaitlistModal(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Bell size={18} style={{ color: "var(--accent)" }} /> Join {waitlistPlan === "STUDIO" ? "Studio" : "Host"} Plan Waitlist</h3>
              <button className="modal-close-btn" onClick={() => setShowWaitlistModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ marginTop: 14 }}>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                The <strong>{waitlistPlan === "STUDIO" ? "Studio Plan" : "Host Plan"}</strong> gives you extended sessions, custom event branding, and full audience analytics. Enter your email below to get early updates!
              </p>

              <form onSubmit={handleWaitlistSubmit} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--text)",
                      fontSize: 14
                    }}
                  />
                </div>
                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowWaitlistModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingWaitlist}>
                    {submittingWaitlist ? <><Loader2 size={13} className="spin" /> Joining...</> : <><Bell size={13} /> Join Waitlist</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}