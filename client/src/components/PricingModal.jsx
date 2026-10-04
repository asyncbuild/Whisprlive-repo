import React, { useState } from "react";
import { Check, Sparkles, Zap, Shield, Crown, X, Loader2 } from "lucide-react";
import API from "../api/axios";
import { useToast } from "../context/ToastContext";
import { useGeoCurrency } from "../utils/geoCurrency";

export default function PricingModal({ isOpen, onClose, currentUser, onPaymentSuccess }) {
  const [billingCycle, setBillingCycle] = useState("YEARLY"); // "MONTHLY" | "YEARLY"
  const [loadingPlan, setLoadingPlan] = useState(null);
  const geoCurrency = useGeoCurrency();
  const { toast } = useToast();

  if (!isOpen) return null;

  const isINR = geoCurrency.isIndia;
  const activeCurrency = isINR ? "INR" : "USD";
  const isYearly = billingCycle === "YEARLY";

  // Price matrix identical to Landing Page
  const prices = {
    ROOM_PASS: {
      price: isINR ? 499 : 7,
      formatted: isINR ? "₹499" : "$7",
      periodText: "per 24-hour pass",
      badge: "Single Event",
    },
    HOST: {
      monthly: isINR ? 799 : 12,
      yearly: isINR ? 7990 : 99,
      formatted: isYearly 
        ? (isINR ? "₹7,990" : "$99") 
        : (isINR ? "₹799" : "$12"),
      effectiveMonthly: isYearly
        ? (isINR ? "₹665/mo" : "$8.25/mo")
        : (isINR ? "₹799/mo" : "$12/mo"),
      periodText: isYearly ? "billed annually" : "billed monthly",
      badge: "Most Popular",
    },
    STUDIO: {
      monthly: isINR ? 1499 : 24,
      yearly: isINR ? 14990 : 199,
      formatted: isYearly
        ? (isINR ? "₹14,990" : "$199")
        : (isINR ? "₹1,499" : "$24"),
      effectiveMonthly: isYearly
        ? (isINR ? "₹1,249/mo" : "$16.50/mo")
        : (isINR ? "₹1,499/mo" : "$24/mo"),
      periodText: isYearly ? "billed annually" : "billed monthly",
      badge: "Full Power",
    },
  };

  const handleCheckout = async (planType) => {
    const token = localStorage.getItem("whisprlive_token");
    if (!token) {
      toast.error("Please sign in to upgrade your subscription.");
      return;
    }

    setLoadingPlan(planType);
    try {
      const res = await API.post("/api/payments/razorpay/create-order", {
        planType,
        billingCycle: planType === "ROOM_PASS" ? "ONETIME" : billingCycle,
        currency: activeCurrency,
      });

      const { orderId, amount, currency, keyId } = res.data;

      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "WhisprLive",
        description: planType === "ROOM_PASS" 
          ? "24-Hour Event Room Pass" 
          : `${planType} Plan (${isYearly ? "1 Year" : "30 Days"})`,
        image: `${window.location.origin}/Logo Bgless.png`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const verifyRes = await API.post("/api/payments/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType,
              billingCycle: planType === "ROOM_PASS" ? "ONETIME" : billingCycle,
            });

            if (verifyRes.data?.user) {
              localStorage.setItem("whisprlive_user", JSON.stringify(verifyRes.data.user));
              if (onPaymentSuccess) onPaymentSuccess(verifyRes.data.user);
            }

            toast.success(verifyRes.data?.message || "Payment successful!");
            onClose();
          } catch (err) {
            toast.error(err.response?.data?.message || "Payment signature verification failed.");
          } finally {
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          },
        },
        prefill: {
          name: currentUser?.username || "WhisprLive Host",
          email: currentUser?.email || "",
        },
        theme: {
          color: "#6366f1",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      setLoadingPlan(null);
      toast.error(err.response?.data?.message || "Failed to initialize checkout.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, backdropFilter: "blur(6px)" }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 960,
          width: "95%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "28px 24px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", color: "var(--accent)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <Sparkles size={14} /> Transparent &amp; Flexible Plans
            </div>
            <h2 style={{ margin: 0, fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 800, color: "var(--text)" }}>
              Upgrade Your Live Audience Experience
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-dim)" }}>
              Choose flexible event passes or unlock vanity URLs, custom branding, and AI moderation.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Controls: Billing Switcher Centered */}
        <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 24px" }}>
          <div className="billing-toggle-container" style={{ background: "var(--surface-2)" }}>
            <div className={`billing-toggle-pill ${isYearly ? "yearly" : "monthly"}`} />
            <button
              type="button"
              className={`billing-toggle-btn ${!isYearly ? "active" : ""}`}
              onClick={() => setBillingCycle("MONTHLY")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`billing-toggle-btn ${isYearly ? "active" : ""}`}
              onClick={() => setBillingCycle("YEARLY")}
            >
              Yearly
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "stretch" }}>
          
          {/* Card 1: 24H Event Pass */}
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 20px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              height: "100%",
              minHeight: 520,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  One-Off Event
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, background: "var(--surface)", color: "var(--text)", padding: "3px 8px", borderRadius: 999, border: "1px solid var(--border)" }}>
                  24H Pass
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Event Pass</h3>
              <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 8, minHeight: 38 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{prices.ROOM_PASS.formatted}</span>
                <span style={{ fontSize: 14, color: "var(--text-dim)", textDecoration: "line-through", fontWeight: 600, opacity: 0.75 }}>
                  {isINR ? "₹799" : "$12"}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 16px", minHeight: 34, display: "flex", alignItems: "center" }}>
                One-time pass per event · Single room
              </p>

              <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, color: "var(--text-dim)", flex: "1 1 auto" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Dedicated Room:</strong> Full 24-hour pass</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Audience Capacity:</strong> 500 questions</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Live Quizzes:</strong> Instant answer reveals</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Unlimited Polls:</strong> Saved templates</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Unbranded Stage:</strong> No watermark</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Data Exports:</strong> Full CSV &amp; TXT</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Team Controls:</strong> Co-host &amp; mod tools</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Session Archive:</strong> 30 days history</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "auto", width: "100%", height: 44, fontWeight: 700 }}
              disabled={loadingPlan === "ROOM_PASS"}
              onClick={() => handleCheckout("ROOM_PASS")}
            >
              {loadingPlan === "ROOM_PASS" ? <><Loader2 size={14} className="spin" /> Processing...</> : `Buy Pass (${prices.ROOM_PASS.formatted})`}
            </button>
          </div>

          {/* Card 2: HOST Plan (Highlighted) */}
          <div
            style={{
              background: "var(--surface)",
              border: "2px solid var(--accent)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 20px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              boxShadow: "0 12px 30px rgba(99,102,241,0.2)",
              height: "100%",
              minHeight: 520,
              boxSizing: "border-box",
            }}
          >
            <div style={{ position: "absolute", top: -11, right: 16, background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 4 }}>
              <Zap size={11} /> POPULAR
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {isYearly ? "Annual Access" : "30-Day Access"}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Host Plan</h3>
              <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 6, minHeight: 38 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{prices.HOST.effectiveMonthly}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 16px", minHeight: 34, display: "flex", alignItems: "center" }}>
                {isYearly ? "365 days access · 2 mos free (Save 20%)" : "30 days full access · No auto-debit"}
              </p>

              <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, color: "var(--text-dim)", flex: "1 1 auto" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Unlimited Rooms:</strong> 60m sessions</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Audience Capacity:</strong> 1,000 questions</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Custom Vanity URL:</strong> /ask/your-event</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>AI Auto-Moderation:</strong> Safety filter</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Team Seats:</strong> Up to 3 co-host seats</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Data Exports:</strong> CSV &amp; JSON data</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Full Interactivity:</strong> Quizzes &amp; polls</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Priority Support:</strong> 90 days history</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: "auto", width: "100%", height: 44, fontWeight: 700 }}
              disabled={loadingPlan === "HOST" || currentUser?.plan === "HOST"}
              onClick={() => handleCheckout("HOST")}
            >
              {loadingPlan === "HOST" ? (
                <><Loader2 size={14} className="spin" /> Processing...</>
              ) : currentUser?.plan === "HOST" ? (
                "Current Active Plan"
              ) : isYearly ? (
                `Upgrade Yearly (${prices.HOST.formatted}/yr)`
              ) : (
                `Upgrade to Host (${prices.HOST.formatted}/mo)`
              )}
            </button>
          </div>

          {/* Card 3: STUDIO Plan */}
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 20px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              height: "100%",
              minHeight: 520,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {isYearly ? "Annual Access" : "30-Day Access"}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, background: "var(--surface)", color: "var(--text)", padding: "3px 8px", borderRadius: 999, border: "1px solid var(--border)" }}>
                  <Crown size={11} style={{ display: "inline", marginRight: 3, verticalAlign: -1 }} /> Studio
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Studio Plan</h3>
              <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 6, minHeight: 38 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{prices.STUDIO.effectiveMonthly}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 16px", minHeight: 34, display: "flex", alignItems: "center" }}>
                {isYearly ? "365 days access · 2 mos free (Save 20%)" : "30 days full access · No auto-debit"}
              </p>

              <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, color: "var(--text-dim)", flex: "1 1 auto" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Extended Sessions:</strong> Unlimited 120m</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Audience Capacity:</strong> 2,500 questions</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Custom Branding:</strong> Event logo &amp; colors</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>AI Clustering:</strong> Question deduplication</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>AI Executive Recap:</strong> Sentiment recap</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Unlimited Seats:</strong> Co-hosts &amp; moderators</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Executive Reports:</strong> Branded PDF export</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <Check size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} /> <span><strong style={{ color: "var(--text)" }}>Dedicated SLA:</strong> 1 year archive &amp; support</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "auto", width: "100%", height: 44, fontWeight: 700 }}
              disabled={loadingPlan === "STUDIO" || currentUser?.plan === "STUDIO"}
              onClick={() => handleCheckout("STUDIO")}
            >
              {loadingPlan === "STUDIO" ? (
                <><Loader2 size={14} className="spin" /> Processing...</>
              ) : currentUser?.plan === "STUDIO" ? (
                "Current Active Plan"
              ) : isYearly ? (
                `Get Studio Yearly (${prices.STUDIO.formatted}/yr)`
              ) : (
                `Get Studio Plan (${prices.STUDIO.formatted}/mo)`
              )}
            </button>
          </div>

        </div>

        {/* Footer Guarantee */}
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--text-dim)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={14} style={{ color: "var(--success)" }} /> Secured via Razorpay · Instant digital access · Non-refundable · No auto-renewals.
          </div>
          <div>Need a custom enterprise agreement? <a href="mailto:whisprlive@gmail.com" style={{ color: "var(--accent)", fontWeight: 700 }}>Contact sales</a></div>
        </div>
      </div>
    </div>
  );
}
