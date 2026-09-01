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
  const { user, token } = useAuth();
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

    const currentToken = localStorage.getItem('pulse_token');
    if (!currentToken) {
      toast.info('Please sign in or create an account first.');
      navigate("/signin");
      return;
    }

    setLoadingPlan(planType);
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
      setLoadingPlan(null);
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
                    <li><Check size={15} /> Up to 50 guests</li>
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
                    <li><Check size={15} /> Up to 500 guests</li>
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
                  <div className="price-amount">₹799<span style={{ fontSize: "14px" }}> /mo</span></div>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li>• Unlimited rooms</li>
                    <li>• Up to 1,000 guests</li>
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
                  <div className="price-amount">₹1,499<span style={{ fontSize: "14px" }}> /event</span></div>
                  <ul className="price-list" style={{ marginTop: "20px" }}>
                    <li>• Up to 2,500 guests</li>
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
                <h4>Product</h4>
                <a onClick={() => scrollTo("about")}>About</a>
                <a onClick={() => scrollTo("pricing")}>Pricing</a>
                <a onClick={() => navigate("/ask/demo")}>Live page example</a>
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