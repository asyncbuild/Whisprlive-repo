import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function AuthGoogleButton({ onLoading }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    if (onLoading) onLoading(true);
    try {
      const res = await API.post("/api/auth/google", {
        credential: credentialResponse.credential,
      });

      if (login) login(res.data.user, res.data.token);
      toast.success("Google Sign-In Successful!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Google Sign-In failed");
      setLoading(false);
      if (onLoading) onLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontWeight: 600, fontSize: 14 }}>
          <Loader2 size={20} className="spin" />
          Signing in with Google...
        </div>
        <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Redirecting to your dashboard...</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => {
          toast.error("Google Login Failed");
          setLoading(false);
          if (onLoading) onLoading(false);
        }}
        theme="outline"
        size="large"
        shape="rectangular"
        width="320"
        logo_alignment="center"
        text="continue_with"
      />
    </div>
  );
}
