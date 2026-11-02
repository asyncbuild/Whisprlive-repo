import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Check, Radio, Bell, Loader2, ShieldCheck,
  Smartphone, Users, MessageCircle, ChevronDown, BarChart2, Tv, Sparkles, Trophy,
  Download, Palette, Lock, CheckCircle2, MessageSquare, Layers, Globe, Calendar, Flame, Share2, X, Star,
  Zap, Award, Heart, MessageSquareQuote, ThumbsUp
} from "lucide-react";
import QRCode from "qrcode";
import API from "../api/axios";
import Brand from "../components/Brand";
import HeroDemoShowcase from "../components/HeroDemoShowcase";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useGeoCurrency } from "../utils/geoCurrency";
import RollingPrice from "../components/RollingPrice";

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

const WALL_OF_LOVE = [
  {
    name: "Arjun Mehta",
    handle: "@arjun_dev",
    role: "Organizer, Bangalore Tech Summit",
    platform: "X",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
    text: "We ditched passing handheld microphones around a 400-person auditorium. With WhisprLive, attendees just scanned the stage QR on the LED screen and submitted questions in 0 seconds. The candid honesty was unreal.",
    highlight: "Saved 25 mins of awkward mic-running"
  },
  {
    name: "Dr. Priya Nair",
    handle: "@priya_nair_iit",
    role: "Dean of Student Affairs, IIT Fest",
    platform: "LinkedIn",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces",
    text: "Students usually hesitate to raise their hands in front of 600 peers. WhisprLive's 100% anonymous Q&A and live upvotes surfaced the most critical questions instantly. Best event tool we've used.",
    highlight: "100% participation without hand-raising fear"
  },
  {
    name: "Vikram Sen",
    handle: "@vikram_founder",
    role: "VP Engineering, Fintech Town Hall",
    platform: "WhatsApp",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    text: "No logins, no app store downloads. The single 24-hour room pass with instant UPI activation is 10x cheaper and simpler than Slido's recurring enterprise annual lock-in.",
    highlight: "Instant UPI activation & zero friction"
  },
  {
    name: "Sneha Kapur",
    handle: "@snehakapur_live",
    role: "Twitch Partner & Hackathon Host",
    platform: "X",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces",
    text: "The dedicated Projector Stage View with live floating emoji reactions ❤️🔥👏 made our keynote feel like an Apple event. The stream chat went wild.",
    highlight: "Felt like an Apple keynote presentation"
  },
  {
    name: "Karan Singhania",
    handle: "@karansingh_ai",
    role: "Lead, GDG Community",
    platform: "ProductHunt",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
    text: "The Groq AI topic clustering automatically grouped 280 attendee questions into 5 core themes. Saved our moderators from drowning in duplicates during the live panel.",
    highlight: "AI topic clustering is magical"
  },
  {
    name: "Rohan Verma",
    handle: "@rohan_product",
    role: "Product Lead, SaaS All-Hands",
    platform: "LinkedIn",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=faces",
    text: "Exporting clean branded PDF reports right after the event wrapped up gave our leadership team instant sentiment recaps and actionable takeaways.",
    highlight: "Exported instant PDF summaries"
  }
];

const MARQUEE_ITEMS = [
  { icon: Users, label: "Tech Conferences & Summits" },
  { icon: MessageSquare, label: "All-Hands & Town Halls" },
  { icon: Tv, label: "University Fests & Keynotes" },
  { icon: Smartphone, label: "Live Webinars & Virtual AMAs" },
  { icon: Trophy, label: "Interactive Quizzes & Hackathons" },
  { icon: Sparkles, label: "AI Topic Clustering & Recaps" },
  { icon: Radio, label: "Dedicated 4K Stage Projector" },
  { icon: ShieldCheck, label: "100% Anonymous & Zero Friction" },
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
  const [openFaq, setOpenFaq] = useState(0);
  const [pricingBillingCycle, setPricingBillingCycle] = useState("YEARLY");

  const homeRef = useRef(null);
  const aboutRef = useRef(null);
  const comparisonRef = useRef(null);
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
    const targetMap = { 
      home: homeRef, 
      about: aboutRef, 
      comparison: comparisonRef, 
      features: featuresRef, 
      pricing: pricingRef, 
      liveMock: liveMockRef 
    };
    const target = targetMap[key]?.current;
    if (!target) return;

    if (key === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const navEl = document.querySelector(".nav");
    const subnavEl = document.querySelector(".subnav-join-bar");
    let totalHeaderHeight = (navEl?.offsetHeight || 72);
    if (window.innerWidth <= 960 && subnavEl) {
      totalHeaderHeight += (subnavEl.offsetHeight || 56);
    }
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
    <div style={{ position: "relative", overflowX: "hidden" }}>
      {/* FROSTED GLASS HEADER (Backdoor AI Inspired) */}
      <nav className="nav">
        <div className="container nav-inner">
          <Brand onClick={() => scrollTo("home")} />
          <div className="nav-links">
            <a className="nav-link" onClick={() => scrollTo("about")}>How it works</a>
            <a className="nav-link" onClick={() => scrollTo("comparison")}>Why Us</a>
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
              <button 
                className="btn btn-primary btn-sm rounded-pill"
                onClick={() => navigate("/dashboard")}
              >
                Dashboard <ArrowRight size={13} />
              </button>
            ) : (
              <button 
                className="btn btn-primary btn-sm rounded-pill"
                onClick={() => navigate("/signup")}
              >
                Start free <ArrowRight size={13} />
              </button>
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

        {/* Mobile menu dropdown */}
        <div className={`mobile-menu-dropdown-wrap ${menuOpen ? "is-open" : ""}`}>
          <div className="container mobile-menu-dropdown">
            <a className="nav-link" onClick={() => scrollTo("about")}>How it works</a>
            <a className="nav-link" onClick={() => scrollTo("comparison")}>Why Us</a>
            <a className="nav-link" onClick={() => scrollTo("features")}>Features</a>
            <a className="nav-link" onClick={() => scrollTo("pricing")}>Pricing</a>
            {isLoggedIn ? (
              <a className="nav-link" onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}>Dashboard</a>
            ) : (
              <a className="nav-link" onClick={() => { setMenuOpen(false); navigate("/signin"); }}>Sign in</a>
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

      {/* HERO SECTION WITH BACKDOOR AMBIENT LIGHTING & EDITORIAL TYPOGRAPHY */}
      <div ref={homeRef} style={{ position: "relative" }}>
        {/* Ambient Sky/Sunlight Backdrop Effect */}
        <div className="backdoor-hero-backdrop" aria-hidden="true">
          <div className="backdoor-hero-glow-1" />
          <div className="backdoor-hero-glow-2" />
        </div>

        <section className="hero">
          <div className="container hero-grid">
            <div>
              {/* Backdoor Style Rating Badge */}
              <div className="backdoor-rating-badge">
                <div className="backdoor-rating-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="backdoor-star" size={13} fill="#f59e0b" stroke="#f59e0b" />
                  ))}
                </div>
                <span>Rated <strong>4.9 out of 5</strong> · 500+ Conferences</span>
              </div>

              {/* Bold Headline with Serif Italic Punch */}
              <h1 className="backdoor-headline">
                Engage Your Audience Live.{" "}
                <span className="font-serif-italic font-normal" style={{ color: "var(--accent)" }}>
                  Zero friction.
                </span>
              </h1>

              {/* Clean Subhead */}
              <p className="backdoor-subhead">
                The audience interaction platform for conferences, college fests, town halls, and live streams. Point phone camera at the stage QR to ask anonymous questions, upvote in real-time, and react live.
              </p>

              {/* Squircle Value Checklist (Like Backdoor's "Finds startups · Emails founders · Follows up") */}
              <div className="backdoor-pill-list">
                <div className="backdoor-pill-item">
                  <span className="backdoor-squircle orange">
                    <Smartphone size={14} />
                  </span>
                  <span>0s QR Join · No App</span>
                </div>
                <div className="backdoor-pill-item">
                  <span className="backdoor-squircle blue">
                    <MessageCircle size={14} />
                  </span>
                  <span>100% Anonymous Q&amp;A</span>
                </div>
                <div className="backdoor-pill-item">
                  <span className="backdoor-squircle green">
                    <Tv size={14} />
                  </span>
                  <span>4K Stage Projector</span>
                </div>
              </div>

              {/* Signature Dark Glass CTA + Secondary Pill */}
              <div className="hero-actions" style={{ alignItems: "center", gap: 14 }}>
                <div className="dark-glass-wrap">
                  <div className="dark-glass-shadow" />
                  <button
                    type="button"
                    className="dark-glass-btn"
                    onClick={() => navigate(isLoggedIn ? "/dashboard" : "/signup")}
                  >
                    <span className="dark-glass-content">
                      {isLoggedIn ? "Go to Dashboard" : "Start a free session"}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  className="backdoor-pill-btn"
                  onClick={() => navigate("/try")}
                >
                  Try interactive demo <ArrowUpRight size={15} />
                </button>
              </div>

              {/* Social Proof Counter with Real Avatar Stack */}
              <div className="backdoor-social-proof">
                <div className="backdoor-avatar-stack">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces" alt="Organizer" className="backdoor-avatar" />
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces" alt="Speaker" className="backdoor-avatar" />
                  <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&crop=faces" alt="Host" className="backdoor-avatar" />
                  <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces" alt="Dean" className="backdoor-avatar" />
                </div>
                <div className="backdoor-social-text">
                  <strong>18,000+</strong> attendees joined across <strong>{displayTotal}</strong> live sessions
                </div>
              </div>
            </div>

            {/* Right Side: Realistic Phone Mockup with Dynamic Simulated Q&A */}
            <div ref={liveMockRef} className="hero-demo-stage">
              <HeroDemoShowcase />
            </div>
          </div>
        </section>
      </div>

      {/* SILKY SMOOTH INFINITE MARQUEE TICKER (Backdoor Style) */}
      <div className="backdoor-marquee-section">
        <div className="backdoor-marquee-fade left" />
        <div className="backdoor-marquee-fade right" />
        <div className="backdoor-marquee-track">
          {/* Double mapped for seamless infinite loop */}
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="backdoor-marquee-item">
                <Icon size={14} style={{ color: "var(--accent)" }} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* "HOW IT WORKS" 3-STEP WALKTHROUGH */}
      <div ref={aboutRef}>
        <section className="section">
          <div className="container">
            <div className="section-head" style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 36px" }}>
              <span className="section-eyebrow">How It Works</span>
              <h2 style={{ fontSize: "clamp(28px, 3.8vw, 44px)", letterSpacing: "-0.035em" }}>
                Effortless live interaction in 3 simple steps.
              </h2>
              <p style={{ fontSize: 16, color: "var(--text-dim)", marginTop: 10 }}>
                No downloads, no complex room setups, and zero participant friction.
              </p>
            </div>

            <div className="backdoor-steps-grid">
              <div className="backdoor-step-card">
                <div className="backdoor-step-badge">1</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  Launch in 5 Seconds
                </h3>
                <p style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                  Create an instant disposable room or schedule your session in advance with a custom title and custom vanity URL like <code>/ask/your-event</code>.
                </p>
              </div>

              <div className="backdoor-step-card">
                <div className="backdoor-step-badge">2</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  Project the Live Stage
                </h3>
                <p style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                  Beam the dedicated Stage Projector View on your auditorium LED screen. Attendees scan the high-contrast QR code on their phone in 0 seconds.
                </p>
              </div>

              <div className="backdoor-step-card">
                <div className="backdoor-step-badge">3</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  Engage, Upvote &amp; Recap
                </h3>
                <p style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                  Answer top-voted questions live, run timed quizzes with answer reveals, see floating emoji reactions, and download instant PDF executive summaries.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* CONTRAST COMPARISON BENTO: "Pure audience engagement. Not corporate bloat." (Full Bleed on All Monitors) */}
      <section ref={comparisonRef} className="backdoor-comparison-section">
        <div className="backdoor-comparison-glow" />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <span className="section-eyebrow">
              Why Organizers Choose WhisprLive
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.04em", color: "#ffffff", marginTop: 14 }}>
              Pure audience engagement.{" "}
              <span className="font-serif-italic font-normal" style={{ color: "#60a5fa" }}>
                Not corporate bloat.
              </span>
            </h2>
            <p style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: 16, marginTop: 12 }}>
              See how WhisprLive eliminates the pain points of legacy corporate audience polling tools.
            </p>
          </div>

          <div className="backdoor-comp-grid">
            {/* Traditional Clunky Tools */}
            <div className="backdoor-comp-card bad">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(239, 68, 68, 0.2)", color: "#f87171", display: "grid", placeItems: "center" }}>
                  <X size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffffff" }}>Clunky Legacy Tools</h4>
                  <span style={{ fontSize: 12.5, color: "#f87171" }}>Slido, Mentimeter, Kahoot</span>
                </div>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "rgba(255, 255, 255, 0.75)" }}>
                  <X size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <span>Forced attendee app downloads or mandatory login walls that kill engagement.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "rgba(255, 255, 255, 0.75)" }}>
                  <X size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <span>Expensive $50–$100/mo locked-in recurring corporate subscriptions.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "rgba(255, 255, 255, 0.75)" }}>
                  <X size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <span>Repetitive, duplicate questions cluttering the presenter screen.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "rgba(255, 255, 255, 0.75)" }}>
                  <X size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <span>No single 24-hour pay-per-event passes for one-off conferences or summits.</span>
                </li>
              </ul>
            </div>

            {/* WhisprLive Engine */}
            <div className="backdoor-comp-card good">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(59, 130, 246, 0.3)", color: "#60a5fa", display: "grid", placeItems: "center" }}>
                  <Check size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffffff" }}>WhisprLive Platform</h4>
                  <span style={{ fontSize: 12.5, color: "#60a5fa" }}>Designed for live events &amp; speed</span>
                </div>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#ffffff" }}>
                  <Check size={16} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
                  <span><strong>0-Second QR Access:</strong> Attendees scan and interact immediately with zero signup.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#ffffff" }}>
                  <Check size={16} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
                  <span><strong>Pay-Per-Event Passes:</strong> Instant ₹399 / $6 24h passes via UPI &amp; cards. No recurring lock-in.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#ffffff" }}>
                  <Check size={16} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
                  <span><strong>4K Stage Projector:</strong> High-impact presentation screen with live floating emoji reactions.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#ffffff" }}>
                  <Check size={16} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
                  <span><strong>Groq AI Intelligence:</strong> Multilingual profanity filter &amp; semantic topic clustering.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES BENTO GRID */}
      <div ref={featuresRef}>
        <section className="section" style={{ background: "var(--surface-2)" }}>
          <div className="container">
            <div className="section-head" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 48px" }}>
              <span className="section-eyebrow">Powerful Features</span>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.035em" }}>
                Everything you need to run unforgettable live sessions.
              </h2>
              <p style={{ color: "var(--text-dim)", fontSize: 16, marginTop: 10 }}>
                Engineered for speed, privacy, and seamless on-stage presentation.
              </p>
            </div>

            <div className="feature-grid">
              {/* Card 1: 100% Anonymous Live Q&A */}
              <div className="feature-card">
                <div className="feature-card-icon">
                  <MessageCircle size={22} strokeWidth={1.8} />
                </div>
                <h3 className="feature-card-title">100% Anonymous Live Q&amp;A</h3>
                <p className="feature-card-desc">
                  Audience members submit questions and upvote in real time without creating an account or logging in. Hosts spotlight, pin, and answer from one clean screen.
                </p>
              </div>

              {/* Card 2: Live Polls, Quizzes & Word Clouds */}
              <div className="feature-card">
                <div className="feature-card-icon">
                  <BarChart2 size={22} strokeWidth={1.8} />
                </div>
                <h3 className="feature-card-title">Live Polls, Quizzes &amp; Word Clouds</h3>
                <p className="feature-card-desc">
                  Launch multiple-choice polls with live percentage bars, dynamic real-time word clouds, and interactive Quizzes with synchronized answer reveals.
                </p>
              </div>

              {/* Card 3: Dedicated Projector Stage View */}
              <div className="feature-card">
                <div className="feature-card-icon">
                  <Tv size={22} strokeWidth={1.8} />
                </div>
                <h3 className="feature-card-title">Dedicated Projector Stage View</h3>
                <p className="feature-card-desc">
                  Display a stunning presentation screen (<code style={{ fontSize: 13, color: "var(--accent)" }}>/stage/:code</code>) for stage LED walls with Q&amp;A stream, active poll results, and live reactions.
                </p>
              </div>

              {/* Card 4: AI Topic Clusters & Executive Recaps */}
              <div className="feature-card">
                <div className="feature-card-icon">
                  <Sparkles size={22} strokeWidth={1.8} />
                </div>
                <h3 className="feature-card-title">AI Topic Clusters &amp; Executive Recaps</h3>
                <p className="feature-card-desc">
                  Automatically deduplicate repetitive questions into semantic topic themes. Includes automated multilingual toxicity filtering and audience sentiment analysis.
                </p>
              </div>

              {/* Card 5: Custom Event Branding & URLs */}
              <div className="feature-card">
                <div className="feature-card-icon">
                  <Palette size={22} strokeWidth={1.8} />
                </div>
                <h3 className="feature-card-title">Custom Event Branding &amp; URLs</h3>
                <p className="feature-card-desc">
                  Embed your company, conference, or sponsor logo directly onto attendee QR code badges and projector screens, complete with custom vanity room URLs.
                </p>
              </div>

              {/* Card 6: Co-hosts & Multi-Format Exports */}
              <div className="feature-card">
                <div className="feature-card-icon">
                  <Download size={22} strokeWidth={1.8} />
                </div>
                <h3 className="feature-card-title">Co-hosts &amp; Multi-Format Exports</h3>
                <p className="feature-card-desc">
                  Invite team members to moderate question queues live. Export full session data to Plain Text (.txt), CSV spreadsheet (.csv), structured JSON, or branded executive PDF reports.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* PRICING SECTION ("Plans from ₹28 a day" - Backdoor AI Framing) */}
      <div ref={pricingRef}>
        <section className="section pricing-section-wrap">
          <div className="container">
            <div className="section-head" style={{ marginBottom: 24, textAlign: "center", maxWidth: 640, margin: "0 auto 28px" }}>
              <span className="section-eyebrow">Transparent Pricing</span>
              <h2 style={{ fontSize: "clamp(30px, 4.2vw, 46px)", letterSpacing: "-0.04em" }}>
                {geoCurrency.isIndia ? "Plans from ₹28 a day." : "Plans from $0.40 a day."}
              </h2>
              <p style={{ color: "var(--text-dim)", fontSize: 15.5, marginTop: 10 }}>
                Room creation, discovery, and audience attendance are 100% free. You only pay for active outreach, extended duration &amp; AI.
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
                  <div className="price-savings-row">
                    <span className="price-savings-pill neutral">No expiration · 100% Free</span>
                  </div>
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
                  <div className="price-savings-row">
                    <span className="price-savings-pill neutral">Single 24h event · No subscription</span>
                  </div>
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
                      <RollingPrice
                        currency={geoCurrency.symbol}
                        amount={
                          pricingBillingCycle === "YEARLY" 
                            ? (geoCurrency.isIndia ? "665" : "8.25") 
                            : (geoCurrency.isIndia ? "799" : "12")
                        }
                        period="/mo"
                        cycle={pricingBillingCycle}
                      />
                    </span>
                  </div>
                  <p className="price-subtitle">
                    Unlimited rooms &amp; hosting · No auto-debit
                  </p>
                  <div className="price-savings-row">
                    {pricingBillingCycle === "YEARLY" ? (
                      <span className="price-savings-pill highlight">
                        <Sparkles size={11} /> {geoCurrency.isIndia ? "₹7,990/yr billed annually (Save 20%)" : "$99/yr billed annually (Save 20%)"}
                      </span>
                    ) : (
                      <span className="price-savings-pill neutral">
                        {geoCurrency.isIndia ? "₹799 billed monthly" : "$12 billed monthly"}
                      </span>
                    )}
                  </div>
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
                  ) : (
                    "Upgrade to Host"
                  )}
                </button>
              </div>

              {/* Studio Plan */}
              <div className="price-card price-card-studio">
                <span className="price-tag studio-tag">
                  <Sparkles size={11} style={{ display: "inline", marginRight: 3, verticalAlign: -1 }} /> Scale &amp; AI
                </span>
                <div className="price-card-body">
                  <div className="price-plan" style={{ color: "#8b5cf6" }}>Studio Plan</div>
                  <div className="price-amount-wrap">
                    <span className="price-amount">
                      <RollingPrice
                        currency={geoCurrency.symbol}
                        amount={
                          pricingBillingCycle === "YEARLY" 
                            ? (geoCurrency.isIndia ? "1,249" : "16.50") 
                            : (geoCurrency.isIndia ? "1,499" : "24")
                        }
                        period="/mo"
                        cycle={pricingBillingCycle}
                      />
                    </span>
                  </div>
                  <p className="price-subtitle">
                    Full AI suite, custom branding &amp; scale · No auto-debit
                  </p>
                  <div className="price-savings-row">
                    {pricingBillingCycle === "YEARLY" ? (
                      <span className="price-savings-pill highlight studio">
                        <Sparkles size={11} /> {geoCurrency.isIndia ? "₹14,990/yr billed annually (Save 20%)" : "$199/yr billed annually (Save 20%)"}
                      </span>
                    ) : (
                      <span className="price-savings-pill neutral">
                        {geoCurrency.isIndia ? "₹1,499 billed monthly" : "$24 billed monthly"}
                      </span>
                    )}
                  </div>
                  <ul className="price-list">
                    <li><Check size={14} /> <span><strong>Extended Sessions:</strong> Unlimited 120m</span></li>
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 2,500 questions/room</span></li>
                    <li><Check size={14} /> <span><strong>Custom Event Logo:</strong> Stamped on QR &amp; Stage</span></li>
                    <li><span className="ai-feature-tag"><Sparkles size={10} /> AI</span> <span><strong>Multilingual Moderation:</strong> Abusive flagging</span></li>
                    <li><span className="ai-feature-tag"><Sparkles size={10} /> AI</span> <span><strong>Topic Clustering:</strong> Deduplication</span></li>
                    <li><span className="ai-feature-tag"><Sparkles size={10} /> AI</span> <span><strong>Executive Summary:</strong> Sentiment recap</span></li>
                    <li><Check size={14} /> <span><strong>Unlimited Seats:</strong> Co-hosts &amp; moderators</span></li>
                    <li><Check size={14} /> <span><strong>Executive Reports:</strong> Branded PDF export</span></li>
                  </ul>
                </div>
                <button
                  className="btn btn-studio btn-block"
                  disabled={loadingPlan === "STUDIO"}
                  onClick={() => handleCheckout("STUDIO")}
                >
                  {loadingPlan === "STUDIO" ? (
                    <><Loader2 size={14} className="spin" /> Processing...</>
                  ) : (
                    "Upgrade to Studio"
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* WALL OF LOVE / TESTIMONIALS (Backdoor AI Inspired) */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="section-head" style={{ textAlign: "center", maxWidth: 660, margin: "0 auto" }}>
            <span className="section-eyebrow">Wall of Love</span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.035em" }}>
              Loved by organizers &amp; speakers worldwide.
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: 16, marginTop: 10 }}>
              Real messages from hosts and attendees who switched from bulky legacy tools to WhisprLive.
            </p>
          </div>

          <div className="backdoor-wall-grid">
            {WALL_OF_LOVE.map((t, i) => (
              <div key={i} className="backdoor-wall-card">
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={t.avatar} alt={t.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{t.handle}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "var(--surface-2)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                      {t.platform}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
                    {[...Array(t.rating)].map((_, r) => (
                      <Star key={r} size={12} fill="#f59e0b" stroke="#f59e0b" />
                    ))}
                  </div>

                  <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text)", margin: 0 }}>
                    “{t.text}”
                  </p>
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed var(--border)", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                  ✓ {t.highlight}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="section faq-section">
        <div className="container">
          <div className="section-head" style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 40px" }}>
            <span className="section-eyebrow">Frequently Asked Questions</span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: "-0.035em" }}>
              Questions, answered.
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: 16, marginTop: 10 }}>
              Keep your audience focused on your talk. Participants scan, ask, vote, and react without creating yet another account.
            </p>
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

      {/* FINAL HIGH-IMPACT CALL TO ACTION (Backdoor AI Inspired) */}
      <section style={{ padding: "60px 0 90px", position: "relative" }}>
        <div className="container">
          <div className="backdoor-cta-card">
            <span className="section-eyebrow" style={{ marginBottom: 14 }}>
              Free to start · No app · Zero friction
            </span>
            <h2 style={{ fontSize: "clamp(26px, 3.8vw, 48px)", letterSpacing: "-0.04em", margin: "14px 0" }}>
              Your next unforgettable event is one scan away.
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: "clamp(15px, 1.2vw, 17px)", maxWidth: 540, margin: "0 auto 28px" }}>
              Launch a live Q&amp;A room in seconds. Display the 4K projector screen and let your audience do the rest.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
              <div className="dark-glass-wrap">
                <div className="dark-glass-shadow" />
                <button
                  type="button"
                  className="dark-glass-btn"
                  onClick={() => navigate(isLoggedIn ? "/dashboard" : "/signup")}
                >
                  <span className="dark-glass-content">
                    {isLoggedIn ? "Go to Dashboard" : "Start a free session"}
                    <ArrowRight size={16} />
                  </span>
                </button>
              </div>

              <button
                type="button"
                className="backdoor-pill-btn"
                onClick={() => navigate("/try")}
              >
                Try interactive demo <ArrowUpRight size={15} />
              </button>
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
                <a onClick={() => scrollTo("about")}>How it works</a>
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-dim)" }}>
              <span className="beacon-dot" style={{ background: "#10b981", width: 6, height: 6 }} />
              <span>All systems operational</span>
            </div>
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
