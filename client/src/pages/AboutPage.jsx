import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { ArrowLeft, Zap, Shield, Clock, Users } from 'lucide-react';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="policy-wrap" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", paddingBottom: 60 }}>
      <nav className="nav">
        <div className="container nav-inner">
          <Brand onClick={() => navigate('/')} />
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            <ArrowLeft size={15} /> Back to Home
          </button>
        </div>
      </nav>

      <div className="container" style={{ maxWidth: 800, marginTop: 40 }}>
        <div style={{ marginBottom: 30 }}>
          <span className="eyebrow" style={{ textTransform: "uppercase", fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.05em" }}>
            About WhisprLive
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, marginBottom: 12, fontFamily: "var(--font-display)" }}>
            Built for the moment, not the meeting.
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-dim)", lineHeight: 1.6 }}>
            WhisprLive turns any audience into an interactive, live conversation. Share one room link, watch questions roll in as audience members type, and close the room when your session ends.
          </p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "grid", gap: 24 }}>
          <section>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={20} style={{ color: "var(--accent)" }} /> Our Mission
            </h3>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6, fontSize: 14.5 }}>
              Traditional presentation Q&amp;As are awkward. Audiences hesitate to raise hands or download heavy applications just to ask a quick question. WhisprLive eliminates friction: zero app downloads, zero audience signups, instant WebSocket real-time delivery.
            </p>
          </section>

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "8px 0" }} />

          <section>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={20} style={{ color: "var(--accent)" }} /> Disposable Live Rooms
            </h3>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6, fontSize: 14.5 }}>
              Every WhisprLive room is temporary and lightweight. Rooms automatically close when timers expire or when hosts end them, leaving no leftover clutter or lingering open channels.
            </p>
          </section>

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "8px 0" }} />

          <section>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={20} style={{ color: "var(--accent)" }} /> Anonymous Audience Voice
            </h3>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6, fontSize: 14.5 }}>
              Audience members can ask questions anonymously without creating accounts or revealing sensitive personal data, encouraging honest engagement and higher participation rates.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer" style={{ marginTop: 80 }}>
        <div className="container">
          <div className="footer-top">
            <Brand onClick={() => navigate("/")} />
            <div className="footer-cols">
              <div className="footer-col">
                <h4>Product</h4>
                <Link to="/about">About Us</Link>
                <Link to="/contact">Contact Us</Link>
                <a onClick={() => navigate("/#pricing")}>Pricing</a>
              </div>
              <div className="footer-col">
                <h4>Legal &amp; Policy</h4>
                <Link to="/terms">Terms &amp; Conditions</Link>
                <Link to="/privacy">Privacy Policy</Link>
                <Link to="/refund">Refund Policy</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 WhisprLive. All rights reserved.</span>
            <span className="mono">Made for live rooms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
