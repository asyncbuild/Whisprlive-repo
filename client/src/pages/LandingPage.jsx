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
              {/* Solo Plan */}
              <div className="price-card">
                <div className="price-plan">Solo</div>
                <div className="price-amount">₹0<span> /month</span></div>
                <ul className="price-list">
                  <li><Check size={15} /> 3 live sessions / month</li>
                  <li><Check size={15} /> Up to 50 guests per room</li>
                  <li><Check size={15} /> 5 or 15-minute timers</li>
                </ul>
                <button
                  className="btn btn-ghost btn-block"
                  disabled={currentPlan === "SOLO"}
                  onClick={() => handleCheckout("SOLO")}
                >
                  {currentPlan === "SOLO" ? "Current Plan" : "Choose Solo"}
                </button>
              </div>

              {/* Host Plan */}
              <div className="price-card featured">
                {currentPlan === "HOST" ? (
                  <span className="price-tag" style={{ background: "var(--success)" }}>Active Plan</span>
                ) : (
                  <span className="price-tag">Most hosts pick this</span>
                )}
                <div className="price-plan">Host</div>
                <div className="price-amount">₹1,499<span> /month</span></div>
                <ul className="price-list">
                  <li><Check size={15} /> Unlimited sessions</li>
                  <li><Check size={15} /> Up to 1,000 guests per room</li>
                  <li><Check size={15} /> Custom timers up to 60 min</li>
                  <li><Check size={15} /> Export every response</li>
                  <li><Check size={15} /> UPI & International Cards</li>
                </ul>
                <button
                  className="btn btn-primary btn-block"
                  disabled={currentPlan === "HOST" || loadingPlan === "HOST"}
                  onClick={() => handleCheckout("HOST")}
                >
                  {loadingPlan === "HOST" ? "Redirecting..." : currentPlan === "HOST" ? "Current Plan" : "Choose Host"}
                </button>
              </div>

              {/* Studio Plan */}
              <div className="price-card">
                {currentPlan === "STUDIO" && (
                  <span className="price-tag" style={{ background: "var(--success)" }}>Active Plan</span>
                )}
                <div className="price-plan">Studio</div>
                <div className="price-amount">₹3,999<span> /month</span></div>
                <ul className="price-list">
                  <li><Check size={15} /> Everything in Host</li>
                  <li><Check size={15} /> 5 seats, shared session history</li>
                  <li><Check size={15} /> Custom timers up to 120 min</li>
                  <li><Check size={15} /> UPI & International Cards</li>
                </ul>
                <button
                  className="btn btn-ghost btn-block"
                  disabled={currentPlan === "STUDIO" || loadingPlan === "STUDIO"}
                  onClick={() => handleCheckout("STUDIO")}
                >
                  {loadingPlan === "STUDIO" ? "Redirecting..." : currentPlan === "STUDIO" ? "Current Plan" : "Choose Studio"}
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