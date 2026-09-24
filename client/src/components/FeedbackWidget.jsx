import React, { useState, useEffect } from "react";
import { MessageSquarePlus, X, Send, Loader2, Sparkles, Bug, Lightbulb, MessageCircle } from "lucide-react";
import API from "../api/axios";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

export default function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("suggestion"); // suggestion | bug | general
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      toast.error("Please enter your feedback or suggestion.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.post("/api/feedback", {
        category,
        message: cleanMsg,
        email: email.trim() || undefined
      });
      toast.success(res.data?.message || "🎉 Thank you for your feedback!");
      setMessage("");
      setIsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="feedback-widget-btn"
        title="Give feedback or suggest a feature"
      >
        <MessageSquarePlus size={16} />
        <span>Feedback</span>
      </button>

      {/* Feedback Modal / Drawer Popup */}
      {isOpen && (
        <div
          className="modal-overlay feedback-modal-overlay"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="modal-content feedback-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} style={{ color: "var(--accent)" }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Suggest a Feature or Feedback</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Category Pills */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 8 }}>
                  Feedback Type
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`chip ${category === "suggestion" ? "active" : ""}`}
                    onClick={() => setCategory("suggestion")}
                    style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Lightbulb size={13} /> Feature Idea
                  </button>
                  <button
                    type="button"
                    className={`chip ${category === "bug" ? "active" : ""}`}
                    onClick={() => setCategory("bug")}
                    style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Bug size={13} /> Report Bug
                  </button>
                  <button
                    type="button"
                    className={`chip ${category === "general" ? "active" : ""}`}
                    onClick={() => setCategory("general")}
                    style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <MessageCircle size={13} /> General
                  </button>
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                  Your Idea / Feedback
                </label>
                <textarea
                  placeholder={
                    category === "suggestion"
                      ? "What feature or improvement would make WhisprLive great for you?"
                      : category === "bug"
                        ? "Describe what happened or what isn't working..."
                        : "Share your thoughts or feedback..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: 13.5,
                    resize: "vertical",
                    fontFamily: "inherit"
                  }}
                />
              </div>

              {/* Optional Email Field */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                  Your Email <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(Optional, for follow-up)</span>
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 13px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: 13.5
                  }}
                />
              </div>

              {/* Form Action Buttons */}
              <div className="modal-actions" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!message.trim() || submitting}>
                  {submitting ? (
                    <><Loader2 size={13} className="spin" /> Sending...</>
                  ) : (
                    <><Send size={13} /> Send Feedback</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
