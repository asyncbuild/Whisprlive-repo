import React, { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Link2, Clock, Check, Radio, Zap, Menu, X, Bell, Loader2, Sparkles
} from "lucide-react";
import API from "../api/axios";
import Brand from "../components/Brand";
import LiveMockCard from "../components/LiveMockCard";
import { useAuth } from "../context/AuthContext";

import { useToast } from "../context/ToastContext";
import { useGeoCurrency } from "../utils/geoCurrency";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const isLoggedIn = Boolean(token);
  const currentPlan = user?.plan || "SOLO";
  const geoCurrency = useGeoCurrency();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState("HOST");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [displayTotal, setDisplayTotal] = useState("...");
  const refs = { home: useRef(null), about: useRef(null), pricing: useRef(null), liveMock: useRef(null) };

  React.useEffect(() => {
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
    refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCheckout = async (planType) => {
    if (planType === 'SOLO') {
      navigate(isLoggedIn ? "/dashboard" : "/signup");
      return;
    }

    const currentToken = localStorage.getItem('whisprlive_token');
    if (!currentToken) {
      toast.info('Please sign in or create an account first.');
      navigate("/signin");
      return;
    }

    setLoadingPlan(planType);
    try {
      // 1. Create order on backend
      const res = await API.post("/api/payments/razorpay/create-order", { planType, currency: geoCurrency.code });
      const { orderId, amount, currency, keyId } = res.data;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: keyId || import.meta.env.RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "WhisprLive",
        description: "24-Hour Room Pass",
        image: `${window.location.origin}/Logo Bgless.png`,
        order_id: orderId,
        handler: async (response) => {
          try {
            // 3. Send signature to backend for verification
            const verifyRes = await API.post("/api/payments/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data?.user) {
              localStorage.setItem('whisprlive_user', JSON.stringify(verifyRes.data.user));
              if (refreshUser) refreshUser();
            }
            toast.success("Payment successful! 1 Room Pass has been credited.");
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
            <button className="icon-btn nav-menu-btn" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="container mobile-menu-dropdown">
            <a className="nav-link" onClick={() => scrollTo("home")}>Home</a>
            <a className="nav-link" onClick={() => scrollTo("about")}>About</a>
            <a className="nav-link" onClick={() => scrollTo("pricing")}>Pricing</a>
            {!isLoggedIn && (
              <div className="mobile-menu-auth">
                <button className="btn btn-ghost btn-sm btn-block" onClick={() => { setMenuOpen(false); navigate("/signin"); }}>Sign in</button>
                <button className="btn btn-primary btn-sm btn-block" onClick={() => { setMenuOpen(false); navigate("/signup"); }}>Get started</button>
              </div>
            )}
          </div>
        )}
      </nav>

      <div ref={refs.home}>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow"><Radio size={13} />Live Q&amp;A · Audience Feedback · Real-Time Walls</span>
              <h1>Live Q&amp;A &amp; Anonymous Feedback.<br />Zero Friction.</h1>
              <p className="hero-sub">
                WhisprLive turns any audience, event, or social story into a real-time conversation.
                Share one link or QR code — watch questions, ideas, and honest feedback roll in as people type them.
              </p>
              <div className="hero-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(isLoggedIn ? "/dashboard" : "/signup")}
                >
                  {isLoggedIn ? "Go to Dashboard" : "Start a session"} <ArrowRight size={16} />
                </button>
                <button className="btn btn-ghost" onClick={() => navigate("/ask/demo")}>
                  See a live page <ArrowUpRight size={16} />
                </button>
              </div>

              {/* Join Live Room Input Box */}
              <div className="join-room-card">
                <label className="join-room-label">
                  <Radio size={13} style={{ color: "var(--live)" }} /> Joining a live Q&amp;A room?
                </label>
                <form onSubmit={handleJoinRoom} className="join-room-form">
                  <input
                    type="text"
                    placeholder="Enter Room Code (e.g. 8tVmSOa1)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="join-room-input"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm join-room-btn"
                    disabled={!joinCode.trim()}
                  >
                    Join Room <ArrowRight size={14} />
                  </button>
                </form>
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
                  <span className="hero-meta-num mono">180ms</span>
                  <span className="hero-meta-label">avg. message delay</span>
                </div>
              </div>
            </div>
            <div ref={refs.liveMock}>
              <LiveMockCard />
            </div>
          </div>
        </section>
      </div>

      <div ref={refs.about}>
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
                <h3>1-Click Link or QR Code</h3>
                <p>Share on Instagram, WhatsApp, or project on stage. Guests join instantly in seconds — no downloads, signups, or app installs.</p>
              </div>
              <div className="feature">
                <div className="feature-icon"><Zap size={19} /></div>
                <h3>100% True Anonymity</h3>
                <p>Complete privacy for your audience. People feel safe submitting bold questions, candid thoughts, and honest feedback.</p>
              </div>
              <div className="feature">
                <div className="feature-icon"><Clock size={19} /></div>
                <h3>Disposable Timed Rooms</h3>
                <p>Set a 15-min or 24-hr session up front. When time's up, the room closes itself automatically so no messages linger.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div ref={refs.pricing}>
        <section className="section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">Pricing</span>
              <h2>Start free. Upgrade when the rooms get bigger.</h2>
            </div>
            <div className="pricing-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {/* Solo Free */}
              <div className="price-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="price-plan">Solo (Free)</div>
                  <div className="price-amount">{geoCurrency.symbol}0</div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>Forever free</p>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li><Check size={15} /> 3 rooms / month</li>
                    <li><Check size={15} /> Up to 15 messages / room</li>
                    <li><Check size={15} /> 15-min timers</li>
                    <li><Check size={15} /> Start now only</li>
                    <li><Check size={15} /> 7 days history retention</li>
                  </ul>
                </div>
                <button
                  className={`btn ${isLoggedIn ? "btn-ghost" : "btn-primary"} btn-block`}
                  disabled={isLoggedIn}
                  onClick={() => navigate(isLoggedIn ? "/dashboard" : "/signup")}
                  style={{ marginTop: "24px" }}
                >
                  {isLoggedIn ? "Current Free Tier" : "Continue with Solo plan"}
                </button>
              </div>

              {/* 24h Room Pass */}
              <div className="price-card featured" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span className="price-tag">Popular for Events</span>
                <div>
                  <div className="price-plan" style={{ color: "var(--accent)", fontWeight: 700 }}>24h Room Pass</div>
                  <div className="price-amount">{geoCurrency.formatted}</div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>One-time pass per event</p>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li><Check size={15} /> 1 room for 24 hours</li>
                    <li><Check size={15} /> Up to 500 messages / room</li>
                    <li><Check size={15} /> Scheduled start supported</li>
                    <li><Check size={15} /> 30 days history retention</li>
                    <li><Check size={15} /> Export transcript (.txt)</li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: "24px" }}
                  disabled={loadingPlan === "ROOM_PASS"}
                  onClick={() => handleCheckout("ROOM_PASS")}
                >
                  {loadingPlan === "ROOM_PASS" ? "Redirecting..." : `Buy Room Pass (${geoCurrency.formatted})`}
                </button>
              </div>

              {/* Host Plan (Coming Soon) */}
              <div className="price-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="price-plan">Host</div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: "var(--surface-2)", color: "var(--text-dim)", padding: "2px 8px", borderRadius: 999 }}>Soon</span>
                  </div>
                  <div className="price-amount" style={{ fontSize: 22, marginTop: 6, fontWeight: 800 }}>
                    {geoCurrency.isIndia ? "₹349/mo" : "$9/mo"}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>For active hosts &amp; speakers</p>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li><Check size={15} /> Unlimited rooms</li>
                    <li><Check size={15} /> Up to 1,000 messages / room</li>
                    <li><Check size={15} /> 60-min room timers</li>
                    <li><Check size={15} /> Scheduled start</li>
                    <li><Check size={15} /> 90 days history retention</li>
                  </ul>
                </div>
                <button
                  className="btn btn-soft btn-block"
                  style={{ marginTop: "24px" }}
                  onClick={() => openWaitlist("HOST")}
                >
                  <Bell size={14} /> Notify Me
                </button>
              </div>

              {/* Studio Plan (Coming Soon) */}
              <div className="price-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="price-plan">Studio</div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: "var(--surface-2)", color: "var(--text-dim)", padding: "2px 8px", borderRadius: 999 }}>Soon</span>
                  </div>
                  <div className="price-amount" style={{ fontSize: 22, marginTop: 6, fontWeight: 800 }}>
                    {geoCurrency.isIndia ? "₹799/mo" : "$19/mo"}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>For conferences &amp; studios</p>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li><Check size={15} /> Unlimited rooms</li>
                    <li><Check size={15} /> Up to 2,500 messages / room</li>
                    <li><Check size={15} /> 120-min room timers</li>
                    <li><Check size={15} /> 1 year history retention</li>
                    <li><Check size={15} /> Export (.txt &amp; CSV)</li>
                    <li><Check size={15} /> Priority email support</li>
                  </ul>
                </div>
                <button
                  className="btn btn-soft btn-block"
                  style={{ marginTop: "24px" }}
                  onClick={() => openWaitlist("STUDIO")}
                >
                  <Bell size={14} /> Notify Me
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>


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