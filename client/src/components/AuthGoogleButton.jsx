import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function AuthGoogleButton({ onLoading, text = "Continue with Google" }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      if (onLoading) onLoading(true);
      try {
        const res = await API.post("/api/auth/google", {
          accessToken: tokenResponse.access_token,
        });

        if (login) login(res.data.user, res.data.token);
        toast.success("Google Sign-In Successful!");
        navigate("/dashboard");
      } catch (err) {
        toast.error(err.response?.data?.message || "Google Sign-In failed");
        setLoading(false);
        if (onLoading) onLoading(false);
      }
    },
    onError: () => {
      toast.error("Google Login Failed");
      setLoading(false);
      if (onLoading) onLoading(false);
    },
  });

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 0", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontWeight: 600, fontSize: 13.5 }}>
          <Loader2 size={18} className="spin" />
          Signing in with Google...
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", margin: "6px 0 12px" }}>
      <button
        type="button"
        onClick={() => googleLogin()}
        className="custom-google-auth-btn"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "11px 18px",
          borderRadius: "var(--radius-md, 10px)",
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "var(--font-sans, inherit)",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          background: isDark ? "#111827" : "#FFFFFF",
          color: isDark ? "#F8FAFC" : "#1E293B",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #CBD5E1",
          boxShadow: isDark
            ? "0 2px 8px rgba(0, 0, 0, 0.45)"
            : "0 1px 4px rgba(0, 0, 0, 0.06)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.3)" : "#94A3B8";
          e.currentTarget.style.background = isDark ? "#1F2937" : "#F8FAFC";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.14)" : "#CBD5E1";
          e.currentTarget.style.background = isDark ? "#111827" : "#FFFFFF";
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0, display: "block" }}>
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>{text}</span>
      </button>
    </div>
  );
}
