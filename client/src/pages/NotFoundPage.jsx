import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Radio, ArrowRight, Home, Search, Sparkles } from "lucide-react";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  const handleJoin = (e) => {
    e?.preventDefault();
    const clean = roomCode.trim();
    if (!clean) return;
    const extracted = clean.includes("/ask/") ? clean.split("/ask/")[1]?.trim() : clean;
    navigate(`/ask/${extracted}`);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      {/* Top Navigation */}
      <nav className="nav">
        <div className="container nav-inner">
          <Brand onClick={() => navigate("/")} />
          <div className="nav-actions">
            <ThemeToggle />
            <Link to="/" className="btn btn-ghost btn-sm nav-hide-mobile">
              Home
            </Link>
            <Link to="/signup" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* 404 Main Body */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div
          style={{
            maxWidth: 580,
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "48px 32px",
            textAlign: "center",
            boxShadow: "var(--card-shadow)",
            position: "relative"
          }}
        >
          <span
            className="eyebrow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            <Radio size={12} /> 404 Error · Room or Page Not Found
          </span>

          <h1 style={{ fontSize: "clamp(32px, 6vw, 44px)", fontWeight: 800, fontFamily: "var(--font-display)", margin: "0 0 12px", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Lost in the Live Stream?
          </h1>

          <p style={{ fontSize: 15.5, color: "var(--text-dim)", lineHeight: 1.55, maxWidth: 440, margin: "0 auto 28px" }}>
            The session, link, or page you are looking for has closed, expired, or does not exist.
          </p>

          {/* Quick Room Code Direct Join */}
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              marginBottom: 28,
              textAlign: "left"
            }}
          >
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Search size={14} style={{ color: "var(--accent)" }} /> Looking to join an active Q&amp;A room?
            </label>
            <form onSubmit={handleJoin} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Enter Room Code (e.g. WHISPR-782)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13.5,
                  outline: "none"
                }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!roomCode.trim()}
                style={{ padding: "0 18px", height: 42, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                Join Room <ArrowRight size={14} />
              </button>
            </form>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
              <Home size={15} /> Back to Homepage
            </Link>
            <Link to="/try" className="btn btn-secondary" style={{ padding: "10px 22px", fontSize: 14 }}>
              <Sparkles size={15} /> Try WhisprLive Free
            </Link>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "20px", textAlign: "center", fontSize: 13, color: "var(--text-faint)" }}>
        WhisprLive &copy; {new Date().getFullYear()} · Real-Time Audience Interaction
      </footer>
    </div>
  );
}
