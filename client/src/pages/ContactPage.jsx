import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { ArrowLeft, Mail, MapPin, Clock, MessageSquare } from 'lucide-react';

export default function ContactPage() {
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
            Get in Touch
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, marginBottom: 12, fontFamily: "var(--font-display)" }}>
            Contact Us
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Have questions about Room Passes, session hosting, or payment inquiries? Our team is here to help.
          </p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "var(--surface-2)", padding: 20, borderRadius: 12, border: "1px solid var(--border)" }}>
              <Mail size={22} style={{ color: "var(--accent)", marginBottom: 10 }} />
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Customer Support Email</h4>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", marginBottom: 10 }}>For technical support, payment issues, or room pass help:</p>
              <a href="mailto:whisprlive@gmail.com" style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", textDecoration: "underline" }}>
                whisprlive@gmail.com
              </a>
            </div>

            <div style={{ background: "var(--surface-2)", padding: 20, borderRadius: 12, border: "1px solid var(--border)" }}>
              <Clock size={22} style={{ color: "var(--accent)", marginBottom: 10 }} />
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Support Operating Hours</h4>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                Monday to Saturday: 9:00 AM – 7:00 PM (IST)
                <br />
                Response Time: Within 24 hours
              </p>
            </div>
          </div>

          <div style={{ background: "var(--surface-2)", padding: 20, borderRadius: 12, border: "1px solid var(--border)" }}>
            <MapPin size={22} style={{ color: "var(--accent)", marginBottom: 10 }} />
            <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Operating Address</h4>
            <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6 }}>
              WhisprLive HQ
              <br />
              India
            </p>
          </div>

          <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid var(--accent)", padding: 20, borderRadius: 12 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={16} /> Payment &amp; Billing Assistance
            </h4>
            <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
              If you experienced a transaction failure where funds were debited but your Room Pass was not credited, please include your <strong>Razorpay Payment ID</strong> in your email for priority resolution.
            </p>
          </div>
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
