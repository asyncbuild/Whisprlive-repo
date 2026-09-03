import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
            Privacy
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, marginBottom: 12, fontFamily: "var(--font-display)" }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
            Last updated: September 3, 2026
          </p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "grid", gap: 24, fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>1. Information We Collect</h3>
            <p>
              We collect minimal information necessary to deliver our services:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li><strong>Account Information:</strong> Email address, name/username, and password hash (or Google profile ID via Google OAuth).</li>
              <li><strong>Session Data:</strong> Room titles, scheduled times, and questions submitted during sessions.</li>
              <li><strong>Payment Information:</strong> Processed securely via Razorpay. We do not store raw credit card numbers or UPI PINs on our servers.</li>
            </ul>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>2. Anonymous Audience Privacy</h3>
            <p>
              Audience members submitting questions in live rooms do not need to create an account or provide personal information. Questions are submitted anonymously to protect audience privacy.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>3. How We Use Information</h3>
            <p>
              We use collected information solely to provide, maintain, and improve WhisprLive services, process payments via Razorpay, authenticate account access, and deliver support.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>4. Third-Party Services</h3>
            <p>
              We partner with trusted third-party providers including Google OAuth (authentication) and Razorpay (payment processing). Their data handling is subject to their respective privacy policies.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>5. Contact Privacy Team</h3>
            <p>
              If you have any questions regarding your personal data or privacy rights, reach out to us at <a href="mailto:whisprlive@gmail.com" style={{ color: "var(--accent)" }}>whisprlive@gmail.com</a>.
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
