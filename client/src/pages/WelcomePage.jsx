import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles, QrCode, MessageSquare, BarChart2, ShieldCheck,
  ArrowRight, CheckCircle2, Play, Users, Zap, Radio, Crown
} from "lucide-react";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      {/* Navigation */}
      <nav className="nav">
        <div className="container nav-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
          <Brand onClick={() => navigate("/")} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />
            <Link to="/signin" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
            <Link to="/signup" className="btn btn-primary btn-sm">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Hero Container */}
      <main style={{ flex: 1, padding: "50px 20px 80px" }}>
        <div className="container" style={{ maxWidth: 1040, margin: "0 auto" }}>
          {/* Header Eyebrow & Title */}
          <div style={{ textAlign: "center", maxWidth: 780, margin: "0 auto 48px" }}>
            <span
              className="eyebrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 14px",
                borderRadius: 999,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid var(--border)",
                marginBottom: 16
              }}
            >
              <Radio size={13} /> Live Audience Engagement &amp; Interaction
            </span>
            <h1 style={{ fontSize: "clamp(32px, 5.5vw, 50px)", fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.03em", margin: "0 0 16px", lineHeight: 1.15 }}>
              Turn Passive Listeners Into <span style={{ color: "var(--accent)" }}>Active Participants</span>
            </h1>
            <p style={{ fontSize: 17, color: "var(--text-dim)", lineHeight: 1.6, margin: "0 auto 28px" }}>
              WhisprLive empowers speakers, educators, and event organizers with frictionless anonymous Q&amp;A, live polls, and real-time word clouds. No apps, no attendee accounts—just scan and interact.
            </p>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/signup" className="btn btn-primary" style={{ padding: "12px 28px", fontSize: 15, borderRadius: 999 }}>
                Host Your Free Event <ArrowRight size={16} />
              </Link>
              <Link to="/ask/demo" className="btn btn-secondary" style={{ padding: "12px 24px", fontSize: 15, borderRadius: 999 }}>
                <Play size={16} /> Test Drive Demo Room
              </Link>
            </div>
          </div>

          {/* 4 Feature Value Pillars in Symmetric 2x2 Grid */}
          <div className="welcome-grid-2x2">
            {/* Pillar 1 */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px 20px",
                boxShadow: "var(--card-shadow)"
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}
              >
                <QrCode size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
                0s Attendee Onboarding
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>
                Attendees scan your QR code with their default camera app. No app store downloads or logins required.
              </p>
            </div>

            {/* Pillar 2 */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px 20px",
                boxShadow: "var(--card-shadow)"
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}
              >
                <MessageSquare size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
                100% Anonymous Q&amp;A
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>
                Empower introverts and encourage honest, high-value questions. Crowd upvotes naturally elevate the best topics.
              </p>
            </div>

            {/* Pillar 3 */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px 20px",
                boxShadow: "var(--card-shadow)"
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(255, 90, 54, 0.12)",
                  color: "var(--live)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}
              >
                <BarChart2 size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
                Live Polls &amp; Word Clouds
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>
                Gather instant opinions, feedback, and visualize audience thoughts in beautiful organic word clouds in seconds.
              </p>
            </div>

            {/* Pillar 4 */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px 20px",
                boxShadow: "var(--card-shadow)"
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(139, 92, 246, 0.12)",
                  color: "#8B5CF6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}
              >
                <Crown size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
                Projector View &amp; Spotlight
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>
                Pin top questions to the big screen, moderate live feeds, and post official speaker answers directly to attendees.
              </p>
            </div>
          </div>

          {/* Bottom Motivation Call to Action */}
          <div
            style={{
              background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "36px 30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
              boxShadow: "var(--card-shadow)"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Sparkles size={18} style={{ color: "var(--accent)" }} />
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>
                  Ready to engage your audience?
                </h2>
              </div>
              <p style={{ fontSize: 14.5, color: "var(--text-dim)", margin: 0 }}>
                Start free with up to 15-minute unlimited attendee rooms. No credit card required.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Link to="/signup" className="btn btn-primary" style={{ padding: "10px 24px", fontSize: 14, borderRadius: 999 }}>
                Create Free Room <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 20px", textAlign: "center", fontSize: 13, color: "var(--text-faint)" }}>
        WhisprLive &copy; {new Date().getFullYear()} · The frictionless live audience interaction platform.
      </footer>
    </div>
  );
}
