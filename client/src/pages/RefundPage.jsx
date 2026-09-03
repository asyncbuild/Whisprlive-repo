import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { ArrowLeft, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function RefundPage() {
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
            Policy
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, marginBottom: 12, fontFamily: "var(--font-display)" }}>
            Cancellation &amp; Refund Policy
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
            Last updated: September 3, 2026
          </p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "grid", gap: 24, fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={20} style={{ color: "var(--accent)" }} /> 1. Digital Goods &amp; Services Notice
            </h3>
            <p>
              WhisprLive provides web-based software services, digital session hosting platforms, and single-event access passes ("Room Passes"). All products offered on WhisprLive are <strong>digital, intangible goods</strong> that are credited to your account immediately upon payment confirmation.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={20} style={{ color: "var(--accent)" }} /> 2. No Refunds &amp; No Cancellations
            </h3>
            <p>
              Due to the immediate digital fulfillment nature of our services:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li><strong>Room Passes &amp; Subscription Upgrades:</strong> All purchases are <strong>final, non-cancellable, and non-refundable</strong> once payment is completed.</li>
              <li>Once a Room Pass credit is added to your account, it remains valid until consumed for a live session.</li>
              <li>Purchases cannot be cancelled or refunded once processed through the Razorpay payment gateway.</li>
            </ul>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={20} style={{ color: "var(--accent)" }} /> 3. Failed Transactions &amp; Billing Discrepancies
            </h3>
            <p>
              If your bank account or payment method was debited but your WhisprLive Room Pass was not credited due to a network or payment gateway glitch:
            </p>
            <ol style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>Please allow up to 15 minutes for automated webhook synchronization.</li>
              <li>If the pass still does not appear in your dashboard, email our billing team at <a href="mailto:whisprlive@gmail.com" style={{ color: "var(--accent)", fontWeight: 700 }}>whisprlive@gmail.com</a> with your <strong>Razorpay Payment ID</strong> and registered email address.</li>
              <li>In verified cases of duplicate billing or payment gateway processing errors where service credit was not delivered, we will manually credit your account or initiate a refund through Razorpay within 5–7 business days.</li>
            </ol>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>4. Contact Support</h3>
            <p>
              For any billing inquiries or transaction support, please reach out to:
              <br />
              <strong>Email:</strong> <a href="mailto:whisprlive@gmail.com" style={{ color: "var(--accent)" }}>whisprlive@gmail.com</a>
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
