import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
            Legal
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, marginBottom: 12, fontFamily: "var(--font-display)" }}>
            Terms &amp; Conditions
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
            Last updated: September 3, 2026
          </p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "grid", gap: 24, fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>1. Acceptance of Terms</h3>
            <p>
              By accessing or using WhisprLive ("Platform", "we", "us", or "our"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>2. Service Description</h3>
            <p>
              WhisprLive provides real-time anonymous Q&amp;A session hosting services allowing hosts to create temporary live rooms and audiences to submit messages. Services are provided on an "as is" and "as available" basis.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>3. Account &amp; User Conduct</h3>
            <p>
              When creating an account via email or Google Authentication, you are responsible for maintaining the confidentiality of your credentials. You agree not to use WhisprLive for unlawful, abusive, harassing, or fraudulent activities.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>4. Room Passes &amp; Digital Goods</h3>
            <p>
              WhisprLive offers one-time digital goods ("Room Passes") and account plan tiers. Purchases grant specific session limits and duration features as described at the time of purchase. Purchases of digital goods are governed by our <Link to="/refund" style={{ color: "var(--accent)", textDecoration: "underline" }}>Cancellation &amp; Refund Policy</Link>.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>5. Limitation of Liability</h3>
            <p>
              WhisprLive shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service, including data loss or session interruptions.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>6. Contact Information</h3>
            <p>
              For questions regarding these Terms, please contact us at <a href="mailto:whisprlive@gmail.com" style={{ color: "var(--accent)" }}>whisprlive@gmail.com</a>.
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
