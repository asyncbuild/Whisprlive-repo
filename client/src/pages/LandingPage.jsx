import React, { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Link2, Clock, Check, Radio, Zap, Menu, X
} from "lucide-react";
import API from "../api/axios";
import Brand from "../components/Brand";
import LiveMockCard from "../components/LiveMockCard";
import { useAuth } from "../context/AuthContext";

import { useToast } from "../context/ToastContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const isLoggedIn = Boolean(token);
  const currentPlan = user?.plan || "SOLO";

  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const refs = { home: useRef(null), about: useRef(null), pricing: useRef(null) };

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
      const res = await API.post("/api/payments/razorpay/create-order", { planType });
      const { orderId, amount, currency, keyId } = res.data;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: keyId || import.meta.env.RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "WhisprLive",
        description: "24-Hour Room Pass",
        image: `${window.location.origin}/favicon.svg`,
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
          color: "#4f46e5",
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
                <button className="btn btn-ghost btn-sm" onClick={() => navigate("/signin")}>Sign in</button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/signup")}>Get started</button>
              </>
            )}
            <button className="icon-btn nav-menu-btn" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="container" style={{ paddingBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <a className="nav-link" onClick={() => scrollTo("home")}>Home</a>
            <a className="nav-link" onClick={() => scrollTo("about")}>About</a>
            <a className="nav-link" onClick={() => scrollTo("pricing")}>Pricing</a>
          </div>
        )}
      </nav>

      <div ref={refs.home}>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow"><Radio size={13} />Live Q&amp;A, without the app</span>
              <h1>The room's questions,<br />live on your screen.</h1>
              <p className="hero-sub">
                WhisprLive turns any audience into a live conversation. Share one link,
                watch questions roll in as people type them, and close the session
                the moment it's done.
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
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">0s</span>
                  <span className="hero-meta-label">to join, no signup</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">12k+</span>
                  <span className="hero-meta-label">sessions hosted</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num mono">180ms</span>
                  <span className="hero-meta-label">avg. message delay</span>
                </div>
              </div>
            </div>
            <LiveMockCard />
          </div>
        </section>
      </div>

      <div ref={refs.about}>
        <section className="section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">About WhisprLive</span>
              <h2>Built for the moment, not the meeting.</h2>
              <p>Every WhisprLive session is a small, disposable room: it opens, it fills with real questions, and it closes. No accounts for guests, no leftover clutter for hosts.</p>
            </div>
            <div className="feature-grid">
              <div className="feature">
                <div className="feature-icon"><Link2 size={19} /></div>
                <h3>One link, no app</h3>
                <p>Anyone joins by tapping a link. No download, no login, no waiting room — they're asking questions in seconds.</p>
              </div>
              <div className="feature">
                <div className="feature-icon"><Zap size={19} /></div>
                <h3>Live, not delayed</h3>
                <p>Messages land on your screen the instant they're sent, ordered by time, so you're always reading the room as it is.</p>
              </div>
              <div className="feature">
                <div className="feature-icon"><Clock size={19} /></div>
                <h3>Sessions that end</h3>
                <p>Set a 5, 15, or 30-minute window up front. When time's up, the room closes itself — no Q&amp;A ever lingers.</p>
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
            <div className="pricing-grid">
              {/* Solo Free */}
              <div className="price-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="price-plan">Solo Free</div>
                  <div className="price-amount">₹0</div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>Forever free</p>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li><Check size={15} /> 3 rooms / month</li>
                    <li><Check size={15} /> Up to 25 messages / room</li>
                    <li><Check size={15} /> 15-min timers</li>
                  </ul>
                </div>
                <button className="btn btn-ghost btn-block" disabled style={{ marginTop: "24px" }}>
                  Current Free Tier
                </button>
              </div>

              {/* 24h Room Pass */}
              <div className="price-card featured" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span className="price-tag">Popular for Events</span>
                <div>
                  <div className="price-plan" style={{ color: "var(--accent)", fontWeight: 700 }}>24h Room Pass</div>
                  <div className="price-amount">₹399</div>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>One-time pass per event</p>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li><Check size={15} /> 1 dedicated room (24 hours)</li>
                    <li><Check size={15} /> Up to 500 messages / room</li>
                    <li><Check size={15} /> Export messages (.txt)</li>
                    <li><Check size={15} /> UPI &amp; Global Cards</li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: "24px" }}
                  disabled={loadingPlan === "ROOM_PASS"}
                  onClick={() => handleCheckout("ROOM_PASS")}
                >
                  {loadingPlan === "ROOM_PASS" ? "Redirecting..." : "Buy Room Pass (₹399)"}
                </button>
              </div>

              {/* Pro Creator (Coming Soon) */}
              <div className="price-card" style={{ opacity: 0.75, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="price-plan">Pro Creator</div>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li>• Unlimited rooms</li>
                    <li>• Up to 1,000 messages / room</li>
                    <li>• Custom branding</li>
                  </ul>
                </div>
                <div style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--text-faint)", padding: "10px", background: "var(--surface-2)", borderRadius: "var(--radius-md)", marginTop: "24px" }}>
                  Coming Soon
                </div>
              </div>

              {/* Conference (Coming Soon) */}
              <div className="price-card" style={{ opacity: 0.75, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="price-plan">Conference</div>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li>• Up to 2,500 messages / room</li>
                    <li>• 48-hour room duration</li>
                    <li>• Live analytics dashboard</li>
                  </ul>
                </div>
                <div style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--text-faint)", padding: "10px", background: "var(--surface-2)", borderRadius: "var(--radius-md)", marginTop: "24px" }}>
                  Coming Soon
                </div>
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
    </div>
  );
}