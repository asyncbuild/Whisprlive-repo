import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Link2, Clock, Check, Radio, Zap, Bell, Loader2, ShieldCheck, Smartphone, Users, MessageCircle, ChevronDown
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
    question: "Is WhisprLive an anonymous Q&A tool?",
    answer: "Yes. Participants can submit questions without creating an account or sharing their name. Hosts can still moderate, pin, and answer questions from one live feed.",
  },
  {
    question: "How does QR code Q&A work at live events and conferences?",
    answer: "The host displays a room QR code on a projector screen or shares a room link. Attendees scan it using their phone camera and immediately submit questions or upvote existing ones anonymously. No app installs or signups are needed.",
  },
  {
    question: "What payment options are available for event passes?",
    answer: "WhisprLive offers pay-per-event pricing without subscriptions. Hosts in India can activate 24-hour live passes using UPI (Google Pay, PhonePe, Paytm), netbanking, or debit/credit cards.",
  },
  {
    question: "Can WhisprLive be used for college fests, classrooms, and webinars?",
    answer: "Yes. It functions as a lightweight audience response system for university lectures, technical workshops, company all-hands, and virtual webinars.",
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
  const homeRef = useRef(null);
  const aboutRef = useRef(null);
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
    document.title = "WhisprLive | Anonymous Live Q&A & QR Code Audience Interaction";
    const description = "Real-time anonymous live Q&A and audience polling for events, webinars, and town halls. Instant access via QR code with pay-per-event passes and UPI support.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;

    QRCode.toDataURL(`${window.location.origin}/ask/demo`, {
      width: 176,
      margin: 1,
      color: { dark: "#102a43", light: "#ffffff" },
    }).then(setDemoQr).catch(() => setDemoQr(""));
  }, []);

  useEffect(() => {
    let isMounted = true;
    // Rapidly change random number under 500 every 45ms while waiting for real backend stats
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
    const targetMap = { home: homeRef, about: aboutRef, pricing: pricingRef, liveMock: liveMockRef };
    targetMap[key]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [pricingBillingCycle, setPricingBillingCycle] = useState("YEARLY");

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
      // 1. Create order on backend
      const res = await API.post("/api/payments/razorpay/create-order", { 
        planType, 
        billingCycle: targetCycle,
        currency: geoCurrency.code 
      });
      const { orderId, amount, currency, keyId } = res.data;

      // 2. Open Razorpay Checkout modal
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
            // 3. Send signature to backend for verification
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

      <div ref={homeRef}>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow"><Radio size={13} />Live Q&amp;A · QR Code Audience Feedback · Real-Time Sessions</span>
              <h1>Anonymous Live Q&amp;A and Audience Interaction for Live Events</h1>
              <p className="hero-sub">
                The frictionless audience response system for conferences, webinars, college fests, and corporate town halls. Participants scan a QR code to submit and upvote questions anonymously—no app downloads, logins, or subscription commitments.
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
                <ShieldCheck size={16} /> <strong>Guests join in seconds.</strong> Hosts get a moderated, real-time question feed.
              </div>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">0s</span>
                  <span className="hero-meta-label">to join, no signup</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">{displayTotal}</span>
                  <span className="hero-meta-label">sessions hosted</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">&lt; 50ms</span>
                  <span className="hero-meta-label">avg. message delay</span>
                </div>
              </div>
            </div>
            <div ref={liveMockRef} className="hero-demo-stage">
              <HeroDemoShowcase />
              <div className="demo-qr-card">
                <div className="demo-qr-copy">
                  <span className="section-eyebrow">Try it from your phone</span>
                  <strong>Scan to join the demo room</strong>
                  <span>No account. No app. Just ask.</span>
                </div>
                {demoQr ? <img src={demoQr} alt="QR code to join the WhisprLive demo room" /> : <div className="qr-loading" aria-label="Loading demo QR code" />}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="trust-strip" aria-label="Supported event types">
        <div className="container trust-strip-inner">
          <span className="trust-label">Made for live moments</span>
          <span><Users size={16} /> Town halls</span>
          <span><MessageCircle size={16} /> Classrooms</span>
          <span><Radio size={16} /> Conferences</span>
          <span><Smartphone size={16} /> Webinars</span>
        </div>
      </section>

      <div ref={aboutRef}>
        <section className="section">
          <div className="container">
            <div className="about-head-grid">
              <div className="section-head" style={{ marginBottom: 0, maxWidth: "100%" }}>
                <span className="section-eyebrow">About WhisprLive</span>
                <h2>Built for events, streams &amp; live interaction.</h2>
                <p>Every WhisprLive session is a disposable room: it opens, it receives questions and feedback in real time, and it closes automatically with zero leftover clutter.</p>
              </div>

              <div className="use-case-card-grid">
                <div className="use-case-card">
                  <div className="use-case-badge">🎤 Keynotes &amp; Events</div>
                  <p>Pass no microphones around. Audience scans QR &amp; asks live questions.</p>
                </div>
                <div className="use-case-card">
                  <div className="use-case-badge">💡 Interactive Feedback</div>
                  <p>Post sticker link. Collect audience ideas &amp; honest story replies.</p>
                </div>
                <div className="use-case-card">
                  <div className="use-case-badge">💬 Townhalls &amp; AMAs</div>
                  <p>True anonymous feedback without corporate fear or judgment.</p>
                </div>
                <div className="use-case-card">
                  <div className="use-case-badge">🎓 Classrooms &amp; Lectures</div>
                  <p>Shy students participate freely without stage fright.</p>
                </div>
              </div>
            </div>
            <div className="feature-grid">
              <div className="feature">
                <div className="feature-icon"><Link2 size={19} /></div>
                <h3>Instant QR Code &amp; Link Access</h3>
                <p>Project the QR code on stage or share a link. Attendees submit live questions in seconds without account registration.</p>
              </div>
              <div className="feature">
                <div className="feature-icon"><Zap size={19} /></div>
                <h3>100% True Anonymity</h3>
                <p>Complete privacy for your audience. People feel safe submitting bold questions, candid thoughts, and honest feedback.</p>
              </div>
              <div className="feature">
                <div className="feature-icon"><Clock size={19} /></div>
                <h3>Pay-Per-Event Disposable Rooms</h3>
                <p>Affordable 24-hour room passes with native UPI and card checkout. No recurring monthly subscriptions.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div ref={pricingRef}>
        <section className="section">
          <div className="container">
            <div className="section-head" style={{ marginBottom: 24 }}>
              <span className="section-eyebrow">Pricing</span>
              <h2>Start free. Upgrade when the rooms get bigger.</h2>
              <p style={{ maxWidth: 540, margin: "8px auto 0", color: "var(--text-dim)", fontSize: 14.5 }}>
                Flexible one-off event passes or full-featured monthly and annual subscriptions.
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
                  Yearly
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
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 100 live participants</span></li>
                    <li><Check size={14} /> <span><strong>Session Duration:</strong> 15m disposable room</span></li>
                    <li><Check size={14} /> <span><strong>Anonymous Q&amp;A:</strong> Live audience upvotes</span></li>
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
                  <p className="price-subtitle">One-time pass per event · Single room</p>
                  <ul className="price-list">
                    <li><Check size={14} /> <span><strong>Dedicated Room:</strong> Full 24-hour event pass</span></li>
                    <li><Check size={14} /> <span><strong>Audience Capacity:</strong> 500 questions per room</span></li>
                    <li><Check size={14} /> <span><strong>Live Quizzes:</strong> Instant answer reveals</span></li>
                    <li><Check size={14} /> <span><strong>Unlimited Polls:</strong> Saved custom templates</span></li>
                    <li><Check size={14} /> <span><strong>Unbranded Stage:</strong> No watermark on projector</span></li>
                    <li><Check size={14} /> <span><strong>Data Exports:</strong> Full CSV spreadsheet &amp; TXT</span></li>
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
                    <li><Check size={14} /> <span><strong>AI Auto-Moderation:</strong> Toxicity filter</span></li>
                    <li><Check size={14} /> <span><strong>Team Seats:</strong> Up to 3 co-hosts/mods</span></li>
                    <li><Check size={14} /> <span><strong>Data Exports:</strong> Structured CSV &amp; JSON</span></li>
                    <li><Check size={14} /> <span><strong>Full Interactivity:</strong> Quizzes &amp; clouds</span></li>
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
                    <li><Check size={14} /> <span><strong>Custom Branding:</strong> Event logo &amp; colors</span></li>
                    <li><Check size={14} /> <span><strong>AI Clustering:</strong> Question deduplication</span></li>
                    <li><Check size={14} /> <span><strong>AI Executive Recap:</strong> Sentiment recap</span></li>
                    <li><Check size={14} /> <span><strong>Unlimited Seats:</strong> Co-hosts &amp; moderators</span></li>
                    <li><Check size={14} /> <span><strong>Executive Reports:</strong> Branded PDF export</span></li>
                    <li><Check size={14} /> <span><strong>Dedicated SLA:</strong> 1 year archive &amp; support</span></li>
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

      <section className="section seo-section">
        <div className="container seo-grid">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="section-eyebrow">A calmer alternative</span>
            <h2>Less friction than the usual audience tools.</h2>
            <p>Keep the room focused on the conversation. Participants scan, ask, and leave without creating another account.</p>
          </div>
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
        </div>
      </section>


      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <Brand onClick={() => scrollTo("home")} />
            <div className="footer-cols">
              <div className="footer-col">
                <h4>Company &amp; Product</h4>
                <Link to="/about">About Us</Link>
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
                The <strong>{waitlistPlan === "STUDIO" ? "Studio ($19/mo · ₹799/mo)" : "Host ($9/mo · ₹349/mo)"}</strong> plan will be launching soon. Enter your email below to get early access and a launch invitation!
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