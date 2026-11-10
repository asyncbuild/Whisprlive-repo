import { Resend } from "resend";

let resendClient = null;

function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "WhisprLive <noreply@whisprlive.live>";
const CLIENT_BASE_URL = process.env.CLIENT_URL || "https://www.whisprlive.live";

/**
 * Common HTML Email Wrapper to ensure consistent branding, mobile responsiveness & email client compatibility
 */
function wrapEmailTemplate({ title, preheader = "", contentHtml }) {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media screen and (max-width: 600px) {
      .container-table { width: 100% !important; }
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
  ${preheader ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
  
  <div style="background-color: #F1F5F9; padding: 40px 16px;">
    <table role="presentation" class="container-table" style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.08); width: 100%; border-collapse: collapse;">
      
      <!-- Top Colorful Gradient Accent Line -->
      <tr>
        <td style="height: 5px; background: linear-gradient(90deg, #2563EB 0%, #38BDF8 50%, #FF5A36 100%); padding: 0;"></td>
      </tr>

      <!-- Brand Header -->
      <tr>
        <td class="mobile-pad" style="padding: 36px 40px 20px; text-align: center;">
          <a href="${CLIENT_BASE_URL}" target="_blank" style="text-decoration: none; display: inline-block;">
            <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: #0F172A;">
              Whispr<span style="color: #2563EB;">Live</span>
            </span>
          </a>
          <p style="margin: 6px 0 0; font-size: 12.5px; color: #64748B; font-weight: 500; letter-spacing: 0.02em;">
            Frictionless Live Audience Engagement
          </p>
        </td>
      </tr>

      <!-- Subtle Divider -->
      <tr>
        <td style="padding: 0 40px;">
          <div style="height: 1px; background-color: #F1F5F9;"></div>
        </td>
      </tr>

      <!-- Main Body Content -->
      <tr>
        <td class="mobile-pad" style="padding: 32px 40px;">
          ${contentHtml}
        </td>
      </tr>

      <!-- Footer Section -->
      <tr>
        <td class="mobile-pad" style="padding: 28px 40px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 12.5px; font-weight: 600; color: #475569;">
            WhisprLive · Live Q&A, Polls, Quizzes & Stage Projector
          </p>
          <p style="margin: 0 0 14px 0; font-size: 11.5px; color: #94A3B8; line-height: 1.5;">
            All rooms close eventually. Make every live session count.<br>
            <a href="${CLIENT_BASE_URL}/dashboard" target="_blank" style="color: #2563EB; text-decoration: none; font-weight: 500;">Dashboard</a> · 
            <a href="${CLIENT_BASE_URL}/#how" target="_blank" style="color: #2563EB; text-decoration: none; font-weight: 500;">How It Works</a> · 
            <a href="${CLIENT_BASE_URL}/#pricing" target="_blank" style="color: #2563EB; text-decoration: none; font-weight: 500;">Pricing</a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #94A3B8;">
            © ${currentYear} WhisprLive. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
  </div>
</body>
</html>
  `;
}

/**
 * 1. Send Welcome Email to a newly registered user
 */
export async function sendWelcomeEmail({ email, username }) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = (username || cleanEmail.split("@")[0]).trim();
  const resend = getResend();
  const dashboardUrl = `${CLIENT_BASE_URL}/dashboard`;

  const contentHtml = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: #EFF6FF; border: 1px solid #BFDBFE; font-size: 26px; text-align: center; margin-bottom: 16px;">
        🎉
      </div>
      <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.025em;">
        Welcome to WhisprLive, ${cleanName}!
      </h1>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Your account is ready. You can now launch frictionless live Q&A sessions, real-time polls, and 4K stage displays for your audience in seconds.
      </p>
    </div>

    <!-- Quick Start Steps Card -->
    <div style="background: linear-gradient(145deg, #F8FAFC 0%, #EFF6FF 100%); border: 1px solid #DBEAFE; border-radius: 16px; padding: 24px 20px; margin-bottom: 28px;">
      <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563EB; margin-bottom: 16px; text-align: center;">
        Get Started in 4 Quick Steps
      </div>

      <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13.5px; color: #334155;">
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 34px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #2563EB; color: #FFFFFF; font-size: 12px; font-weight: 700; text-align: center; line-height: 24px;">1</div>
          </td>
          <td style="padding: 10px 0;">
            <strong style="color: #0F172A;">Create a Live Room</strong><br>
            <span style="color: #64748B; font-size: 12.5px;">Click "Create Room" in your dashboard to generate your room code and instant QR code.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #2563EB; color: #FFFFFF; font-size: 12px; font-weight: 700; text-align: center; line-height: 24px;">2</div>
          </td>
          <td style="padding: 10px 0;">
            <strong style="color: #0F172A;">Display the 4K Stage View</strong><br>
            <span style="color: #64748B; font-size: 12.5px;">Open <code style="background: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #1E3A8A;">/stage/:code</code> on your auditorium LED wall or projector screen.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #2563EB; color: #FFFFFF; font-size: 12px; font-weight: 700; text-align: center; line-height: 24px;">3</div>
          </td>
          <td style="padding: 10px 0;">
            <strong style="color: #0F172A;">Zero-Friction Attendee Join</strong><br>
            <span style="color: #64748B; font-size: 12.5px;">Attendees scan the QR code with their phones and ask questions instantly. No app downloads, no logins required.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #2563EB; color: #FFFFFF; font-size: 12px; font-weight: 700; text-align: center; line-height: 24px;">4</div>
          </td>
          <td style="padding: 10px 0;">
            <strong style="color: #0F172A;">Run Live Polls & Word Clouds</strong><br>
            <span style="color: #64748B; font-size: 12.5px;">Collect real-time sentiment with interactive multiple-choice polls and live-updating word clouds.</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Primary Action Button -->
    <div style="text-align: center; margin: 32px 0 28px;">
      <a href="${dashboardUrl}" target="_blank" style="display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); letter-spacing: -0.01em;">
        Go to Your Dashboard →
      </a>
    </div>

    <!-- Tip Callout -->
    <div style="border-left: 3px solid #3B82F6; background-color: #EFF6FF; border-radius: 0 10px 10px 0; padding: 14px 18px; margin-top: 24px;">
      <p style="margin: 0; font-size: 13px; color: #1E40AF; line-height: 1.55;">
        💡 <strong>Pro Tip:</strong> Bookmark your session room URL or stage screen before stepping on stage so you can transition seamlessly during your talk.
      </p>
    </div>
  `;

  const html = wrapEmailTemplate({
    title: `Welcome to WhisprLive, ${cleanName}!`,
    preheader: "Your account is active. Start running frictionless live Q&A sessions.",
    contentHtml
  });

  if (resend) {
    try {
      const response = await resend.emails.send({
        from: FROM_EMAIL,
        to: cleanEmail,
        subject: `Welcome to WhisprLive, ${cleanName}! 🎉 Your account is ready`,
        html
      });
      console.log(`[EMAIL] Welcome email sent successfully to ${cleanEmail}`);
      return response;
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send welcome email to ${cleanEmail}:`, err);
      return null;
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[DEV MODE EMAIL] Welcome Email to: ${cleanEmail} (${cleanName})`);
    console.log(`Subject: Welcome to WhisprLive, ${cleanName}! 🎉 Your account is ready`);
    console.log(`======================================================\n`);
    return null;
  }
}

/**
 * 2. Send Plan Purchase / Room Pass Receipt Email
 */
export async function sendPlanPurchaseEmail({
  email,
  username,
  planType,
  billingCycle = "MONTHLY",
  amount,
  currency = "INR",
  paymentId,
  orderId,
  planExpiresAt,
  roomPasses = 0
}) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = (username || cleanEmail.split("@")[0]).trim();
  const resend = getResend();
  const dashboardUrl = `${CLIENT_BASE_URL}/dashboard`;

  const isRoomPass = planType === "ROOM_PASS";
  const isYearly = billingCycle === "YEARLY";

  // Format plan display name
  let planDisplayName = "24-Hour Room Pass";
  let billingCycleLabel = "One-Time Event Pass";
  if (planType === "HOST") {
    planDisplayName = "Host Plan";
    billingCycleLabel = isYearly ? "Annual Subscription (2 Months Free)" : "Monthly Subscription";
  } else if (planType === "STUDIO") {
    planDisplayName = "Studio Plan";
    billingCycleLabel = isYearly ? "Annual Subscription (2 Months Free)" : "Monthly Subscription";
  }

  // Format price display
  let formattedAmount = "";
  if (typeof amount === "number") {
    // If in paise / cents
    const num = amount > 1000 ? amount / 100 : amount;
    formattedAmount = currency === "USD" ? `$${num}` : `₹${num.toLocaleString("en-IN")}`;
  } else if (typeof amount === "string" && amount.length > 0) {
    formattedAmount = amount;
  } else {
    // Default fallbacks based on plan
    if (isRoomPass) formattedAmount = currency === "USD" ? "$7" : "₹499";
    else if (planType === "HOST") formattedAmount = isYearly ? (currency === "USD" ? "$99/yr" : "₹7,990/yr") : (currency === "USD" ? "$12/mo" : "₹799/mo");
    else if (planType === "STUDIO") formattedAmount = isYearly ? (currency === "USD" ? "$199/yr" : "₹14,990/yr") : (currency === "USD" ? "$24/mo" : "₹1,499/mo");
  }

  // Validity display
  let validityText = "";
  if (isRoomPass) {
    validityText = `1 Event Pass added (Total Balance: ${roomPasses} ${roomPasses === 1 ? 'Pass' : 'Passes'} · Activates for 24h per room)`;
  } else if (planExpiresAt) {
    const expDate = new Date(planExpiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
    validityText = `Active until ${expDate} (${isYearly ? '1 Full Year' : '1 Month'})`;
  } else {
    validityText = isYearly ? "1 Year Active Access" : "1 Month Active Access";
  }

  // Features list based on plan
  let unlockedFeatures = [];
  if (isRoomPass) {
    unlockedFeatures = [
      "✓ <strong>24-Hour Room Duration</strong> (up from 15 minutes)",
      "✓ <strong>Up to 500 Live Attendees</strong> per event",
      "✓ <strong>Unbranded Projector Stage View</strong> (no WhisprLive watermark)",
      "✓ <strong>Instant CSV & TXT Exports</strong> for post-event analytics",
      "✓ <strong>Interactive Quizzes & Polls</strong> with unlimited templates"
    ];
  } else if (planType === "HOST") {
    unlockedFeatures = [
      "✓ <strong>Unlimited Live Rooms</strong> with up to 1,000 attendees per room",
      "✓ <strong>60-Minute Session Durations</strong> with scheduling support",
      "✓ <strong>Custom Vanity Room URLs</strong> (e.g. /ask/your-conference)",
      "✓ <strong>CSV, JSON & TXT Data Exports</strong> for detailed spreadsheets",
      "✓ <strong>90-Day Analytics Retention</strong> & priority event support"
    ];
  } else {
    // STUDIO
    unlockedFeatures = [
      "✓ <strong>White-Label Custom Event Branding</strong> (upload company logo & custom colors)",
      "✓ <strong>Up to 2,500 Live Attendees</strong> with 120-minute sessions",
      "✓ <strong>Groq AI Semantic Question Clustering</strong> (auto-group duplicate themes)",
      "✓ <strong>AI Executive Recaps & Sentiment Analysis</strong> with 1-click generation",
      "✓ <strong>Branded Executive PDF Reports</strong> ready for leadership & sponsors",
      "✓ <strong>Custom Vanity Slugs</strong> & unlimited poll template library"
    ];
  }

  const contentHtml = `
    <!-- Top Status Badge -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-flex; align-items: center; gap: 6px; background-color: #ECFDF5; border: 1px solid #A7F3D0; color: #047857; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 14px; border-radius: 999px;">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10B981;"></span>
        Payment Confirmed
      </div>
      <h1 style="margin: 16px 0 8px 0; font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.025em;">
        Your ${planDisplayName} is Active! 🚀
      </h1>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Hi <strong style="color: #0F172A;">${cleanName}</strong>, thank you for choosing WhisprLive. Your payment has been processed successfully and your account has been upgraded.
      </p>
    </div>

    <!-- Official Order Receipt Card -->
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 28px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 14px; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">
        Order Receipt & Details
      </div>

      <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 7px 0; color: #64748B;">Plan / Product:</td>
          <td style="padding: 7px 0; text-align: right; font-weight: 700; color: #0F172A;">${planDisplayName}</td>
        </tr>
        <tr>
          <td style="padding: 7px 0; color: #64748B;">Billing Frequency:</td>
          <td style="padding: 7px 0; text-align: right; font-weight: 600; color: #334155;">${billingCycleLabel}</td>
        </tr>
        <tr>
          <td style="padding: 7px 0; color: #64748B;">Amount Paid:</td>
          <td style="padding: 7px 0; text-align: right; font-size: 16px; font-weight: 800; color: #2563EB;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 7px 0; color: #64748B;">Status:</td>
          <td style="padding: 7px 0; text-align: right; font-weight: 700; color: #10B981;">Paid & Verified ✓</td>
        </tr>
        ${validityText ? `
        <tr>
          <td style="padding: 7px 0; color: #64748B;">Validity / Access:</td>
          <td style="padding: 7px 0; text-align: right; font-weight: 600; color: #334155;">${validityText}</td>
        </tr>` : ""}
        ${paymentId ? `
        <tr>
          <td style="padding: 7px 0; color: #94A3B8; font-size: 12px;">Payment ID:</td>
          <td style="padding: 7px 0; text-align: right; font-family: monospace; font-size: 12px; color: #64748B;">${paymentId}</td>
        </tr>` : ""}
        ${orderId ? `
        <tr>
          <td style="padding: 7px 0; color: #94A3B8; font-size: 12px;">Order ID:</td>
          <td style="padding: 7px 0; text-align: right; font-family: monospace; font-size: 12px; color: #64748B;">${orderId}</td>
        </tr>` : ""}
      </table>
    </div>

    <!-- Unlocked Features Section -->
    <div style="background-color: #FFFFFF; border: 1px solid #DBEAFE; border-radius: 14px; padding: 20px 22px; margin-bottom: 28px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1E40AF; margin-bottom: 12px;">
        What You've Unlocked:
      </div>
      <div style="font-size: 13.5px; color: #334155; line-height: 1.8;">
        ${unlockedFeatures.join("<br>")}
      </div>
    </div>

    <!-- Primary Action Button -->
    <div style="text-align: center; margin: 32px 0 24px;">
      <a href="${dashboardUrl}" target="_blank" style="display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); letter-spacing: -0.01em;">
        Launch an Event in Your Dashboard →
      </a>
    </div>

    <!-- Help / Invoice Notice -->
    <p style="margin: 24px 0 0 0; font-size: 12.5px; color: #94A3B8; line-height: 1.6; text-align: center;">
      Need a customized GST invoice for your company, or have questions about your subscription? Simply reply directly to this email or reach us at <a href="mailto:support@whisprlive.live" style="color: #2563EB; text-decoration: none;">support@whisprlive.live</a>.
    </p>
  `;

  const html = wrapEmailTemplate({
    title: `Payment Receipt: Your WhisprLive ${planDisplayName} is Active!`,
    preheader: `Payment confirmed for ${planDisplayName} (${formattedAmount}). Your account has been upgraded.`,
    contentHtml
  });

  if (resend) {
    try {
      const response = await resend.emails.send({
        from: FROM_EMAIL,
        to: cleanEmail,
        subject: `Payment Confirmed: Your WhisprLive ${planDisplayName} is Active! 🚀`,
        html
      });
      console.log(`[EMAIL] Plan purchase receipt email sent successfully to ${cleanEmail}`);
      return response;
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send plan purchase email to ${cleanEmail}:`, err);
      return null;
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[DEV MODE EMAIL] Plan Purchase Receipt to: ${cleanEmail} (${cleanName})`);
    console.log(`Plan: ${planDisplayName} | Amount: ${formattedAmount} | Payment ID: ${paymentId}`);
    console.log(`======================================================\n`);
    return null;
  }
}

/**
 * 3. Send Signup OTP Verification Email
 */
export async function sendSignupOtpEmail({ email, username, otp }) {
  if (!email || !otp) return null;
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = (username || cleanEmail.split("@")[0]).trim();
  const resend = getResend();

  const contentHtml = `
    <h1 style="margin: 0 0 10px 0; font-size: 21px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; text-align: center;">
      Verify Your Email Address
    </h1>
    <p style="margin: 0 0 28px 0; font-size: 14.5px; color: #475569; line-height: 1.6; text-align: center;">
      Hi <strong style="color: #0F172A;">${cleanName}</strong>, enter the 6-digit verification code below to activate your account and start hosting live sessions:
    </p>

    <!-- OTP Code Card -->
    <div style="background: linear-gradient(145deg, #F8FAFC 0%, #EFF6FF 100%); border: 1px solid #DBEAFE; border-radius: 16px; padding: 28px 20px; text-align: center; margin: 0 0 28px 0; box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.8);">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #2563EB; margin-bottom: 12px;">
        One-Time Verification Code
      </div>
      
      <div style="display: inline-block; font-family: 'JetBrains Mono', SFMono-Regular, Consolas, Monaco, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1E3A8A; background: #FFFFFF; padding: 12px 24px; border-radius: 12px; border: 1px solid #BFDBFE; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08); margin-left: 10px;">
        ${otp}
      </div>

      <div style="margin-top: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: #64748B; font-weight: 500;">
        <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: #10B981; margin-right: 6px;"></span>
        Code expires in <strong style="color: #334155; margin-left: 4px;">10 minutes</strong>
      </div>
    </div>

    <!-- Security Callout -->
    <div style="border-left: 3px solid #F59E0B; background-color: #FFFBEB; border-radius: 0 8px 8px 0; padding: 12px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 12.5px; color: #92400E; line-height: 1.5;">
        <strong>Security Tip:</strong> Never share this code with anyone. WhisprLive will never ask for your verification code.
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #94A3B8; line-height: 1.5; text-align: center;">
      If you didn't attempt to create a WhisprLive account, you can safely disregard this email.
    </p>
  `;

  const html = wrapEmailTemplate({
    title: `${otp} is your WhisprLive verification code`,
    preheader: `Your 6-digit verification code is ${otp}. Valid for 10 minutes.`,
    contentHtml
  });

  if (resend) {
    try {
      const response = await resend.emails.send({
        from: FROM_EMAIL,
        to: cleanEmail,
        subject: `${otp} is your WhisprLive verification code`,
        html
      });
      return response;
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send OTP to ${cleanEmail}:`, err);
      throw err;
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[DEV MODE AUTH OTP] Email: ${cleanEmail} | OTP Code: ${otp}`);
    console.log(`======================================================\n`);
    return null;
  }
}

