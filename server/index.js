import dotenv from "dotenv"
dotenv.config()

// Safety check: JWT_SECRET must be explicitly set — no insecure fallback allowed.
if (!process.env.JWT_SECRET) {
  console.error("\n❌ FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.\n");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { nanoid } from "nanoid"
import { verifyToken } from "./middleware/middleware.js"
import { authLimiter, roomCreationLimiter, messageSubmissionLimiter, paymentLimiter, feedbackLimiter, pollVoteLimiter, waitlistLimiter } from "./middleware/rateLimiter.js"
import { parseClientMetadata } from "./utils/deviceTracker.js"
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeSockets } from './sockets/socketHandler.js';
import prisma from "./config/db.js"
import { PLAN_LIMITS } from "./config/plans.js"
import Razorpay from "razorpay";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library"
import { Resend } from "resend"
import { fastCheckLocal, checkToxicity, clusterQuestions, generateSessionSummary } from "./services/aiService.js";
import { validateImageBuffer, checkImageSafety } from "./utils/imageValidator.js";
import { generateSessionPdfReport } from "./utils/pdfReport.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// In-Memory OTP Store for email verification: email -> { code, username, hashedPassword, expiresAt, attempts }
const signupOtpStore = new Map();

// Helper to auto-reconcile and expire monthly user plans (HOST/STUDIO) after exactly 1 month
export async function reconcileUserPlan(user) {
  if (!user) return null;
  if (user.plan && user.plan !== "SOLO" && user.planExpiresAt && new Date() > new Date(user.planExpiresAt)) {
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: "SOLO",
          planExpiresAt: null,
        },
        select: {
          id: true,
          email: true,
          username: true,
          plan: true,
          planExpiresAt: true,
          roomPasses: true,
        },
      });
      return updated;
    } catch (e) {
      console.error("Error auto-expiring user plan:", e);
      return { ...user, plan: "SOLO", planExpiresAt: null };
    }
  }
  return user;
}

// Periodic cleanup of expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of signupOtpStore.entries()) {
    if (data.expiresAt < now) {
      signupOtpStore.delete(email);
    }
  }
}, 5 * 60 * 1000);

const app = express()
const httpServer = createServer(app)

// Enable trust proxy so Express reads real client IP behind proxies/Cloudflare/Render
app.set("trust proxy", 1);

// Rate Limiting & Security Middlewares
app.use(cors())
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Accept-CH", "Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version");
  res.setHeader("Permissions-Policy", 'ch-ua-model="*"');
  next();
});
app.use(express.json({ limit: "5mb" }))

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WhisprLive API Server is running" });
});

// Public Platform Metrics (total rooms/sessions hosted)
app.get("/api/stats", async (req, res) => {
  try {
    const totalSessions = await prisma.room.count();
    let formattedTotal = totalSessions.toLocaleString();
    if (totalSessions >= 1000) {
      formattedTotal = (totalSessions / 1000).toFixed(1) + "k+";
    }
    res.json({ totalSessions, formattedTotal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
})

initializeSockets(io, prisma) // Pass prisma to socket initialization

//Authentication Routes

// Step 1: Send Signup OTP via Resend
app.post("/api/auth/send-signup-otp", authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return res.status(400).json({
      message: "Password is not strong enough. It must contain at least 8 characters, including uppercase, lowercase, numbers, and a special character."
    });
  }
  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.trim();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      // If user already has a regular password, prevent duplicate signup
      if (existingUser.passwordHash && !existingUser.passwordHash.startsWith("GOOGLE_AUTH_")) {
        return res.status(400).json({ message: "An account with this email already exists. Please sign in." });
      }
      // If user signed up with Google, let them proceed through OTP verification to link a password!
    }

    // Generate cryptographically secure random 6-digit code
    const otp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    signupOtpStore.set(cleanEmail, {
      code: otp,
      username: cleanUsername,
      hashedPassword,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });

    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "WhisprLive <onboarding@resend.dev>",
          to: cleanEmail,
          subject: `${otp} is your WhisprLive verification code`,
          html: `
            <div style="background-color: #F1F5F9; padding: 48px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
              <div style="max-width: 520px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.08);">
                
                <!-- Top Colorful Brand Accent Line -->
                <div style="height: 5px; background: linear-gradient(90deg, #2563EB 0%, #38BDF8 50%, #FF5A36 100%);"></div>

                <!-- Header Section -->
                <div style="padding: 36px 36px 20px; text-align: center;">
                  <div style="display: inline-block; margin-bottom: 8px;">
                    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: #0F172A;">
                      Whispr<span style="color: #2563EB;">Live</span>
                    </span>
                  </div>
                  <p style="margin: 0; font-size: 13px; color: #64748B; font-weight: 500; letter-spacing: 0.01em;">
                    Frictionless Live Audience Engagement
                  </p>
                </div>

                <!-- Divider -->
                <div style="height: 1px; background-color: #F1F5F9; margin: 0 36px;"></div>

                <!-- Body Content -->
                <div style="padding: 32px 36px;">
                  <h1 style="margin: 0 0 10px 0; font-size: 21px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; text-align: center;">
                    Verify Your Email Address
                  </h1>
                  <p style="margin: 0 0 28px 0; font-size: 14.5px; color: #475569; line-height: 1.6; text-align: center;">
                    Hi <strong style="color: #0F172A;">${cleanUsername}</strong>, welcome to WhisprLive! Enter the 6-digit verification code below to activate your account and start hosting live sessions:
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

                  <!-- Feature Highlights Box -->
                  <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
                    <div style="font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                      What you can do with WhisprLive:
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 24px;">🚀</td>
                        <td style="padding: 4px 0;"><strong>Create Live Rooms</strong> with instant branded QR codes</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 24px;">💬</td>
                        <td style="padding: 4px 0;"><strong>100% Anonymous Q&A</strong> with live crowd upvoting</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 24px;">📊</td>
                        <td style="padding: 4px 0;"><strong>Interactive Polls</strong> and real-time word clouds</td>
                      </tr>
                    </table>
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
                </div>

                <!-- Footer Section -->
                <div style="padding: 24px 36px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
                  <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                    WhisprLive · The Frictionless Live Audience Engagement Platform
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                    © ${new Date().getFullYear()} WhisprLive. All rights reserved.
                  </p>
                </div>

              </div>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Resend send error:", emailErr);
        return res.status(500).json({ message: "Failed to send verification email. Please check your email address or try again." });
      }
    } else {
      console.log(`\n======================================================`);
      console.log(`[DEV MODE AUTH OTP] Email: ${cleanEmail} | OTP Code: ${otp}`);
      console.log(`======================================================\n`);
    }

    res.json({ message: "Verification code sent to your email", email: cleanEmail });
  } catch (err) {
    console.error("send-signup-otp error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Step 2: Verify Signup OTP & Create Account
app.post("/api/auth/verify-signup-otp", authLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and verification code are required" });
  }
  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = otp.toString().trim();

  const record = signupOtpStore.get(cleanEmail);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ message: "Verification code has expired. Please request a new code." });
  }

  if (record.attempts >= 5) {
    signupOtpStore.delete(cleanEmail);
    return res.status(400).json({ message: "Too many incorrect attempts. Please request a new code." });
  }

  if (record.code !== cleanOtp) {
    record.attempts = (record.attempts || 0) + 1;
    return res.status(400).json({ message: "Incorrect verification code. Please check and try again." });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (user) {
      // User registered with Google previously — link their new password
      user = await prisma.user.update({
        where: { email: cleanEmail },
        data: {
          passwordHash: record.hashedPassword,
          username: record.username || user.username
        },
        select: {
          id: true,
          email: true,
          username: true,
          plan: true,
          roomPasses: true,
          createdAt: true
        }
      });
    } else {
      // Fresh user registration
      user = await prisma.user.create({
        data: {
          username: record.username,
          email: cleanEmail,
          passwordHash: record.hashedPassword,
          plan: "SOLO",
          roomPasses: 0
        },
        select: {
          id: true,
          email: true,
          username: true,
          plan: true,
          roomPasses: true,
          createdAt: true
        }
      });
    }

    signupOtpStore.delete(cleanEmail);

    const secret = JWT_SECRET;
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Account verified successfully!",
      token,
      user,
      isNewUser: true
    });
  } catch (err) {
    console.error("verify-signup-otp error:", err);
    if (err.code === "P2002") {
      return res.status(400).json({ message: "An account with this email already exists. Please sign in." });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// Fallback Direct Signup Route
app.post("/signup", authLimiter, async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" })
  }
  const cleanEmail = email.toLowerCase().trim();
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists, Please Signin" })
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email: cleanEmail,
        passwordHash: hashedPassword
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true
      }
    })
    res.status(201).json({ message: "User created successfully", user: newUser, isNewUser: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// Signin Route
app.post("/signin", authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" })
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(400).json({ message: "User does not exist. Please sign up." });
    }

    // Check if account was created via Google OAuth and has no password yet
    if (user.passwordHash && user.passwordHash.startsWith("GOOGLE_AUTH_")) {
      return res.status(400).json({
        message: "This account was registered using Google Sign-In. Please click 'Continue with Google' to sign in, or use the Signup tab to add an email password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Auto-reconcile expired plans
    user = await reconcileUserPlan(user);

    const secret = JWT_SECRET;
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: "30d" }
    );
    res.json({
      message: "Signin successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        plan: user.plan || "SOLO",
        planExpiresAt: user.planExpiresAt || null,
        roomPasses: user.roomPasses || 0
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

//Google Signin/signup route
app.post("/api/auth/google", authLimiter, async (req, res) => {
  const { credential, accessToken } = req.body;
  if (!credential && !accessToken) {
    return res.status(400).json({
      message: "Google credential or access token is required"
    })
  }
  try {
    let email, name, googleId;

    if (accessToken) {
      // Validate access token audience with Google tokeninfo
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
      if (!tokenInfoRes.ok) {
        return res.status(400).json({ message: "Invalid Google access token" });
      }
      const tokenInfo = await tokenInfoRes.json();
      const validAudience = tokenInfo.aud === process.env.GOOGLE_CLIENT_ID || tokenInfo.azp === process.env.GOOGLE_CLIENT_ID;
      if (!validAudience) {
        return res.status(400).json({ message: "Google token was not issued for this application" });
      }

      // Fetch user profile from Google userinfo API using verified access token
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!userinfoRes.ok) {
        throw new Error("Failed to fetch Google user profile with access token");
      }
      const userinfo = await userinfoRes.json();
      email = userinfo.email;
      name = userinfo.name;
      googleId = userinfo.sub;
    } else {
      // Verify Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      googleId = payload.sub;
    }

    if (!email) {
      return res.status(400).json({
        message: "Google signin failed : Email is required"
      })
    }
    // check if user already exists
    let isNewUser = false;
    let user = await prisma.user.findUnique({
      where: { email }
    })
    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email,
          username: name || email.split("@")[0],
          passwordHash: `GOOGLE_AUTH_${googleId}`,
          plan: "SOLO"
        },
        select: { id: true, email: true, username: true, plan: true, planExpiresAt: true, roomPasses: true },
      })
    } else {
      user = await reconcileUserPlan(user);
    }
    //generate app jwt token
    const secret = JWT_SECRET;
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: "30d" }
    )
    res.json({
      message: "Google Sign-in Successful",
      token,
      isNewUser,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        plan: user.plan || 'SOLO',
        planExpiresAt: user.planExpiresAt || null,
        roomPasses: user.roomPasses || 0
      }
    })
  } catch (error) {
    console.error("Google Signin error:", error)
    res.status(500).json({
      message: "Invalid Google token"
    })
  }
})

//Fetch current user details and plans
app.get("/api/user/me", verifyToken, async (req, res) => {
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, username: true, plan: true, planExpiresAt: true, roomPasses: true },
    });
    if (user) {
      user = await reconcileUserPlan(user);
    }
    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Razorpay Payment Routes
// 1. Create Razorpay Order
app.post("/api/payments/razorpay/create-order", verifyToken, paymentLimiter, async (req, res) => {
  const { planType, billingCycle = "MONTHLY", currency } = req.body;
  const validPlans = ["ROOM_PASS", "HOST", "STUDIO"];
  if (!validPlans.includes(planType)) {
    return res.status(400).json({ message: "Invalid plan type" });
  }

  const isUSD = currency === "USD";
  const isYearly = billingCycle === "YEARLY";
  let amount;

  if (planType === "ROOM_PASS") {
    amount = isUSD ? 700 : 49900; // $7 USD or ₹499 INR
  } else if (planType === "HOST") {
    if (isYearly) {
      amount = isUSD ? 9900 : 799000; // $99/yr (~$8.25/mo) or ₹7,990/yr (~₹665/mo) - 2 Months Free (Save 20%)
    } else {
      amount = isUSD ? 1200 : 79900; // $12/mo or ₹799/mo
    }
  } else if (planType === "STUDIO") {
    if (isYearly) {
      amount = isUSD ? 19900 : 1499000; // $199/yr (~$16.50/mo) or ₹14,990/yr (~₹1,249/mo) - 2 Months Free (Save 20%)
    } else {
      amount = isUSD ? 2400 : 149900; // $24/mo or ₹1,499/mo
    }
  }
  const orderCurrency = isUSD ? "USD" : "INR";

  try {
    const options = {
      amount,
      currency: orderCurrency,
      receipt: `rcpt_${req.user.id.slice(-6)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: req.user.id,
        planType,
        billingCycle: planType === "ROOM_PASS" ? "ONETIME" : billingCycle,
      },
    };

    const order = await razorpay.orders.create(options);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      billingCycle,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ message: "Failed to initialize payment" });
  }
});

// 2. Verify Payment Signature and Activate Plan / Credit Room Pass
app.post("/api/payments/razorpay/verify", verifyToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType, billingCycle = "MONTHLY" } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing payment parameters" });
  }

  try {
    // Generate expected HMAC SHA256 signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    // Constant-time signature comparison to prevent timing side-channel attacks
    const sigBuffer = Buffer.from(generatedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpay_signature, "utf8");
    if (sigBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(sigBuffer, receivedBuffer)) {
      return res.status(400).json({ message: "Invalid transaction signature" });
    }

    // Replay attack protection: ensure this payment ID has not already been processed
    const existingPayment = await prisma.payment.findUnique({
      where: { razorpayPaymentId: razorpay_payment_id }
    });
    if (existingPayment) {
      return res.status(400).json({ message: "This payment has already been redeemed." });
    }

    const targetPlan = ["HOST", "STUDIO"].includes(planType) ? planType : "ROOM_PASS";
    const isYearly = billingCycle === "YEARLY";

    // Calculate expiration: 365 days for Yearly, 30 days for Monthly
    let userUpdateData = {};
    if (targetPlan === "ROOM_PASS") {
      userUpdateData = { roomPasses: { increment: 1 } };
    } else {
      const expiry = new Date();
      if (isYearly) {
        expiry.setDate(expiry.getDate() + 365); // 1 full year
      } else {
        expiry.setDate(expiry.getDate() + 30); // 1 full month
      }
      userUpdateData = {
        plan: targetPlan,
        planExpiresAt: expiry,
      };
    }

    // Atomically record the payment and update user subscription/passes
    const [paymentRecord, updatedUser] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId: req.user.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          plan: targetPlan
        }
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: userUpdateData,
        select: { id: true, email: true, username: true, plan: true, planExpiresAt: true, roomPasses: true }
      })
    ]);

    res.json({
      message: targetPlan === "ROOM_PASS" 
        ? "1 Room Pass credited successfully!" 
        : `${targetPlan} subscription activated successfully for ${isYearly ? '1 year' : '1 month'}!`,
      user: updatedUser,
    });
  } catch (err) {
    console.error("Razorpay verification error:", err);
    res.status(500).json({ message: "Internal verification error" });
  }
});

// Room & Session Routes
async function findRoomAccess(roomCodeOrSlug, userId) {
  const ownedRoom = await prisma.room.findFirst({
    where: {
      OR: [{ roomCode: roomCodeOrSlug }, { customSlug: roomCodeOrSlug }],
      hostId: userId
    }
  });
  if (ownedRoom) return { room: ownedRoom, isHost: true };

  const sharedRoom = await prisma.room.findFirst({
    where: {
      OR: [{ roomCode: roomCodeOrSlug }, { customSlug: roomCodeOrSlug }],
      collaborators: { some: { userId } }
    }
  });
  return sharedRoom ? { room: sharedRoom, isHost: false } : null;
}

// Create new session Route
app.post("/api/rooms", verifyToken, roomCreationLimiter, async (req, res) => {
  const { title, durationMinutes, startsAt, usePass, showPublicFeed, activityType, customSlug } = req.body;
  const parsedDuration = parseInt(durationMinutes, 10);

  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return res.status(400).json({ error: "Invalid duration" });
  }

  // Scheduled start detection
  const isScheduled = startsAt && (new Date(startsAt).getTime() - Date.now() > 60000);

  try {
    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, plan: true, planExpiresAt: true, roomPasses: true },
    });
    if (user) {
      user = await reconcileUserPlan(user);
    }

    const userPlan = user?.plan || "SOLO";
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Count standard (non-pass) rooms created this month
    const standardCount = await prisma.room.count({
      where: {
        hostId: req.user.id,
        isPassUsed: false,
        createdAt: { gte: startOfMonth },
      },
    });

    // Automatically apply Room Pass only when a user is on SOLO tier and has passes.
    let isUsingPass = false;
    if (user.roomPasses > 0 && userPlan === "SOLO") {
      if (usePass || parsedDuration > 15 || isScheduled) {
        isUsingPass = true;
      }
    }

    const activeTier = isUsingPass ? "ROOM_PASS" : userPlan;
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    // Scheduled start validation for Solo tier
    if (isScheduled && !limits.canSchedule) {
      return res.status(403).json({
        error: "Scheduled starts are not supported on the Solo plan. Purchase a Room Pass to schedule sessions in advance.",
      });
    }

    // Custom vanity slug handling (Host & Studio plans)
    let validatedSlug = null;
    if (customSlug && typeof customSlug === "string" && customSlug.trim() !== "") {
      const cleanSlug = customSlug.trim().toLowerCase();
      if (!limits.canCustomSlug) {
        return res.status(403).json({
          error: "Custom room vanity URLs are available exclusively on the Host and Studio plans. Upgrade to claim custom links.",
        });
      }
      if (!/^[a-z0-9_-]{3,30}$/.test(cleanSlug)) {
        return res.status(400).json({
          error: "Custom URL must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores.",
        });
      }
      const existingSlug = await prisma.room.findFirst({
        where: {
          OR: [{ roomCode: cleanSlug }, { customSlug: cleanSlug }],
        },
      });
      if (existingSlug) {
        return res.status(409).json({
          error: "This custom URL slug is already in use. Please choose another unique link.",
        });
      }
      validatedSlug = cleanSlug;
    }

    // Monthly cap check for paid tiers that define one. SOLO is intentionally unlimited.
    if (!isUsingPass && limits.monthlySessions !== Infinity && standardCount >= limits.monthlySessions) {
      return res.status(403).json({
        error: "Your plan has reached its monthly session limit. Purchase a Room Pass to create another.",
      });
    }

    // Duration validation
    if (parsedDuration > limits.maxDurationMinutes) {
      return res.status(403).json({
        error: `Your ${activeTier === "SOLO" ? "Free" : activeTier} plan allows sessions up to ${limits.maxDurationMinutes} minutes only. Purchase a Room Pass to unlock up to 24 hours.`,
      });
    }

    // Deduct pass if used
    if (isUsingPass) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { roomPasses: { decrement: 1 } },
      });
    }

    const roomCode = nanoid(8);
    const sessionStartTime = startsAt ? new Date(startsAt) : new Date();
    const expiresAt = new Date(sessionStartTime.getTime() + parsedDuration * 60000);
    const validActivityType = ["ALL", "POLL", "WORD_CLOUD", "QA"].includes(activityType) ? activityType : "ALL";

    const newRoom = await prisma.room.create({
      data: {
        hostId: req.user.id,
        roomCode,
        customSlug: validatedSlug,
        title: title || "Ask me anything...",
        durationMinutes: parsedDuration,
        startsAt: sessionStartTime,
        expiresAt,
        isPassUsed: isUsingPass,
        showPublicFeed: typeof showPublicFeed === "boolean" ? showPublicFeed : true,
        activityType: validActivityType,
      },
    });

    res.status(201).json({
      message: "Session created successfully",
      room: roomCode,
      customSlug: validatedSlug,
      shareableUrl: `/ask/${validatedSlug || newRoom.roomCode}`,
      isPassUsed: isUsingPass,
      showPublicFeed: newRoom.showPublicFeed,
      activityType: newRoom.activityType,
    });
  } catch (err) {
    console.error("❌ Room Creation Error:", err);
    res.status(500).json({ message: "Failed to create session. Please try again." });
  }
});

// End an active session (closes it in database immediately)
app.patch("/api/rooms/:roomId/end", verifyToken, async (req, res) => {
  const { roomId } = req.params
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    const closedAt = room.closedAt || new Date();
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: {
        isAccepting: false,
        expiresAt: closedAt,
        closedAt
      }
    })
    // Evict message cache for this room (prevents memory leaks)
    evictRoomMessagesCache(roomId);
    await notifyRoomEnded(roomId, room.id);
    res.json({ message: "Session ended successfully", room: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch("/api/rooms/:roomId/close", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) return res.status(404).json({ message: "Room not found or unauthorized" });

    const closedAt = room.closedAt || new Date();
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: { isAccepting: false, expiresAt: closedAt, closedAt }
    });
    evictRoomMessagesCache(roomId);
    io.to(roomId).emit("room_closed", { roomCode: roomId, roomId: room.id });
    // notifyRoomEnded handles session_ended broadcast + collaborator_room_closed to all co-hosts
    await notifyRoomEnded(roomId, room.id);

    res.json({ message: "Room closed successfully", room: updated });
  } catch (err) {
    if (err.code === "P2022") {
      return res.status(503).json({ message: "Room closing is unavailable until the database migration is applied." });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get all sessions Route (filtered by plan history retention days)
app.get("/api/rooms/history", verifyToken, async (req, res) => {
  const userId = req.user.id
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    });
    const userPlan = user?.plan || "SOLO";

    // A past session is any session hosted by the user that has ended, expired, or was closed
    const rooms = await prisma.room.findMany({
      where: {
        hostId: userId,
        OR: [
          { closedAt: { not: null } },
          { expiresAt: { lte: new Date() } },
          { isAccepting: false }
        ]
      },
      include: {
        host: { select: { username: true, email: true } },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = Date.now();
    const filteredRooms = rooms.filter((room) => {
      const activeTier = room.isPassUsed ? "ROOM_PASS" : userPlan;
      const retentionDays = PLAN_LIMITS[activeTier]?.historyRetentionDays || 7;
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
      return (now - new Date(room.createdAt).getTime()) <= retentionMs;
    });

    res.json({ rooms: filteredRooms });
  } catch (err) {
    if (err.code === "P2022") {
      return res.status(503).json({ message: "Room history is unavailable until the database migration is applied." });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/rooms/shared", verifyToken, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        collaborators: { some: { userId: req.user.id } },
        isAccepting: true,
        startsAt: { lte: new Date() },
        expiresAt: { gt: new Date() }
      },
      include: {
        host: { select: { username: true, email: true } },
        _count: { select: { messages: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ rooms });
  } catch (err) {
    if (err.code === "P2021") {
      return res.status(503).json({ rooms: [], message: "Co-hosting is unavailable until its database migration is applied." });
    }
    console.error("Shared rooms lookup error:", err);
    res.status(500).json({ error: "Failed to load shared sessions" });
  }
});

app.get("/api/rooms/:roomId/collaborators", verifyToken, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: req.params.roomId, hostId: req.user.id },
      select: { id: true }
    });
    if (!room) return res.status(404).json({ message: "Room not found or unauthorized" });

    const collaborators = await prisma.roomCollaborator.findMany({
      where: { roomId: room.id },
      include: { user: { select: { id: true, username: true, email: true } } },
      orderBy: { createdAt: "asc" }
    });
    res.json({ collaborators: collaborators.map(({ user, role, createdAt }) => ({ ...user, role, createdAt })) });
  } catch (err) {
    if (err.code === "P2021") {
      return res.status(503).json({ message: "Co-hosting is unavailable until its database migration is applied." });
    }
    console.error("Collaborator list error:", err);
    res.status(500).json({ error: "Failed to load co-hosts" });
  }
});

app.post("/api/rooms/:roomId/collaborators", verifyToken, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Enter the email address of an existing WhisprLive account." });
  }

  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: req.params.roomId, hostId: req.user.id },
      select: { id: true }
    });
    if (!room) return res.status(404).json({ message: "Room not found or unauthorized" });

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, username: true }
    });
    if (!user) return res.status(404).json({ message: "No WhisprLive account was found for that email." });
    if (user.id === req.user.id) return res.status(400).json({ message: "You already own this session." });

    const collaborator = await prisma.roomCollaborator.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      update: {},
      create: { roomId: room.id, userId: user.id, role: "MODERATOR" }
    });

    // Fetch full room info with host details to emit to collaborator's dashboard in real-time
    const fullRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        host: { select: { username: true, email: true } },
        _count: { select: { messages: true } }
      }
    });

    if (fullRoom) {
      io.to(`user_${user.id}`).emit("collaborator_added", {
        room: fullRoom,
        addedBy: req.user.username || "Host"
      });
    }

    res.status(201).json({ message: "Co-host added.", collaborator: { ...user, role: collaborator.role, createdAt: collaborator.createdAt } });
  } catch (err) {
    if (err.code === "P2021") {
      return res.status(503).json({ message: "Co-hosting is unavailable until its database migration is applied." });
    }
    console.error("Add collaborator error:", err);
    res.status(500).json({ error: "Failed to add co-host" });
  }
});

app.delete("/api/rooms/:roomId/collaborators/:userId", verifyToken, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: req.params.roomId, hostId: req.user.id },
      select: { id: true, roomCode: true }
    });
    if (!room) return res.status(404).json({ message: "Room not found or unauthorized" });

    const result = await prisma.roomCollaborator.deleteMany({
      where: { roomId: room.id, userId: req.params.userId }
    });
    if (!result.count) return res.status(404).json({ message: "Co-host not found." });

    io.to(`user_${req.params.userId}`).emit("collaborator_removed", {
      roomId: room.id,
      roomCode: room.roomCode,
      removedBy: req.user.username || "Host"
    });

    res.json({ message: "Co-host removed." });
  } catch (err) {
    if (err.code === "P2021") {
      return res.status(503).json({ message: "Co-hosting is unavailable until its database migration is applied." });
    }
    console.error("Remove collaborator error:", err);
    res.status(500).json({ error: "Failed to remove co-host" });
  }
});

app.get("/api/rooms/:roomId/report", verifyToken, async (req, res) => {
  try {
    const [user, room] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { plan: true }
      }),
      prisma.room.findFirst({
        where: { roomCode: req.params.roomId, hostId: req.user.id }
      })
    ]);

    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    const userPlan = user?.plan || "SOLO";
    const userLimits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.SOLO;
    const roomLimits = room.isPassUsed ? PLAN_LIMITS.ROOM_PASS : userLimits;
    const retentionDays = roomLimits.historyRetentionDays || 7;
    if (Date.now() - new Date(room.createdAt).getTime() > retentionDays * 24 * 60 * 60 * 1000) {
      return res.status(403).json({ error: "This session is outside your history retention period." });
    }

    const [messages, polls] = await Promise.all([
      prisma.message.findMany({
        where: { roomId: room.id },
        select: { content: true, upvotes: true, isAnswered: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.poll.findMany({
        where: { roomId: room.id },
        orderBy: { createdAt: "asc" },
        include: {
          options: { orderBy: { id: "asc" } },
          responses: { select: { word: true } }
        }
      })
    ]);

    const canViewQuestions = Boolean(userLimits.canExport || room.isPassUsed);
    const summary = {
      responseCount: messages.length,
      answeredCount: messages.filter((message) => message.isAnswered || message.status === "answered").length,
      totalUpvotes: messages.reduce((total, message) => total + (message.upvotes || 0), 0),
      pollCount: polls.length,
      pollResponseCount: polls.reduce((total, poll) => total + poll.responses.length, 0)
    };
    const pollSummaries = polls.map((poll) => {
      const words = new Map();
      for (const response of poll.responses) {
        const word = response.word?.trim();
        if (word) words.set(word, (words.get(word) || 0) + 1);
      }

      return {
        question: poll.question,
        type: poll.type,
        totalVotes: poll.responses.length,
        options: poll.options.map((option) => ({ text: option.text, votes: option.votes })),
        words: [...words.entries()]
          .map(([text, count]) => ({ text, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      };
    });

    res.json({
      room: {
        title: room.title,
        roomCode: room.roomCode,
        durationMinutes: room.durationMinutes,
        createdAt: room.createdAt
      },
      summary,
      polls: pollSummaries,
      canViewQuestions,
      canExport: canViewQuestions,
      topQuestions: canViewQuestions
        ? [...messages]
            .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map((message) => ({
              content: message.content,
              upvotes: message.upvotes || 0,
              isAnswered: message.isAnswered || message.status === "answered",
              createdAt: message.createdAt
            }))
        : []
    });
  } catch (err) {
    console.error("Session report error:", err);
    res.status(500).json({ error: "Failed to build session report" });
  }
});

// Join Plan Waitlist (for Host & Studio coming soon plans)
app.post("/api/waitlist", waitlistLimiter, async (req, res) => {
  const { email, plan } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "A valid email address is required." });
  }
  const targetPlan = (plan || "HOST").toUpperCase();
  if (targetPlan !== "HOST" && targetPlan !== "STUDIO") {
    return res.status(400).json({ message: "Invalid plan selected." });
  }

  try {
    const existing = await prisma.planWaitlist.findFirst({
      where: { email: email.trim().toLowerCase(), plan: targetPlan }
    });
    if (existing) {
      return res.json({ message: "You're already on the waitlist! We'll notify you as soon as this plan launches." });
    }
    await prisma.planWaitlist.create({
      data: {
        email: email.trim().toLowerCase(),
        plan: targetPlan
      }
    });
    res.status(201).json({ message: "🎉 Thank you! You've been added to the waitlist. We'll notify you as soon as this plan launches." });
  } catch (err) {
    console.error("Waitlist error:", err);
    res.status(500).json({ message: "Failed to join waitlist. Please try again." });
  }
});

// Submit User Feedback / Feature Suggestion (Rate Limited: max 5 submissions / 15 min / IP)
app.post("/api/feedback", feedbackLimiter, async (req, res) => {
  const { category, message, email } = req.body;
  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ message: "Please provide your feedback or suggestion message." });
  }

  const validCategories = ["suggestion", "bug", "general"];
  const cleanCategory = validCategories.includes((category || "").toLowerCase())
    ? category.toLowerCase()
    : "suggestion";

  try {
    await prisma.feedback.create({
      data: {
        category: cleanCategory,
        message: message.trim(),
        email: email && typeof email === "string" && email.includes("@") ? email.trim() : null
      }
    });
    res.status(201).json({ message: "🎉 Thank you for your feedback! We really appreciate your ideas." });
  } catch (err) {
    console.error("Feedback submission error:", err);
    res.status(500).json({ message: "Failed to submit feedback. Please try again." });
  }
});



// Get all msgs for a specific room 
app.get("/api/rooms/:roomId/messages", verifyToken, async (req, res) => {
  const { roomId } = req.params
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    const owner = await prisma.user.findUnique({ where: { id: room.hostId }, select: { plan: true } });
    const limits = PLAN_LIMITS[owner?.plan || "SOLO"] || PLAN_LIMITS.SOLO;
    const now = new Date();
    const isExpired = room.expiresAt && now > new Date(room.expiresAt);
    const roomLimits = room.isPassUsed ? PLAN_LIMITS.ROOM_PASS : limits;
    const retentionMs = (roomLimits.historyRetentionDays || 7) * 24 * 60 * 60 * 1000;
    const isBeyondRetention = now.getTime() - new Date(room.createdAt).getTime() > retentionMs;
    // A Room Pass grants access only to the room it was used to create.
    const hasRoomEntitlement = room.isPassUsed;

    if (isBeyondRetention || (isExpired && !limits.canExport && !hasRoomEntitlement)) {
      return res.status(403).json({
        error: "Viewing past session responses is a premium feature. Upgrade to Host plan or use a Room Pass.",
        isPremiumLocked: true
      });
    }

    // Serve from in-memory cache (0ms) for active rooms
    const cached = await getOrHydrateRoomMessages(roomId);
    if (cached) {
      return res.json({ messages: getSortedHostMessages(cached) });
    }

    // Fallback to DB query if cache hydration failed
    const messages = await prisma.message.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ messages })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete a selected post session
app.delete("/api/rooms/:roomId", verifyToken, async (req, res) => {
  const { roomId } = req.params
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    // Evict message cache before deleting the room
    evictRoomMessagesCache(roomId);
    await prisma.room.delete({
      where: { id: room.id }
    })
    res.json({ message: "Room deleted successfully" })
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//public routes
//check room status
app.get("/api/rooms/public/:roomId", async (req, res) => {
  const { roomId } = req.params
  if (roomId.toLowerCase() === "demo") {
    return res.json({
      title: "Interactive WhisprLive Demo Room",
      roomCode: "demo",
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      status: "Active",
      canSend: true,
      activityType: "ALL",
      isDemo: true
    });
  }
  try {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ roomCode: roomId }, { customSlug: roomId }]
      },
      select: {
        id: true,
        roomCode: true,
        customSlug: true,
        title: true,
        startsAt: true,
        expiresAt: true,
        isAccepting: true,
        showPublicFeed: true,
        activityType: true,
        brandLogo: true,
        brandColor: true,
        stageTheme: true,
      }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }
    const now = new Date()
    const isNotStarted = now < new Date(room.startsAt)
    const isExpired = now > new Date(room.expiresAt) || !room.isAccepting
    const canSend = !isNotStarted && !isExpired && room.isAccepting
    res.json({
      id: room.id,
      roomCode: room.roomCode,
      customSlug: room.customSlug,
      title: room.title,
      startsAt: room.startsAt,
      expiresAt: room.expiresAt,
      isAccepting: room.isAccepting,
      showPublicFeed: room.showPublicFeed,
      activityType: room.activityType || "ALL",
      brandLogo: room.brandLogo,
      brandColor: room.brandColor,
      stageTheme: room.stageTheme || "dark",
      status: isNotStarted ? 'Scheduled' : isExpired ? 'Expired' : 'Active',
      canSend
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// In-Memory Active Room Cache — Eliminates Neon DB query latency (< 0.05ms)
const activeRoomCache = new Map();

async function getOrHydrateActiveRoom(roomId) {
  if (!roomId) return null;
  const cached = activeRoomCache.get(roomId);
  if (cached) {
    return cached;
  }

  const room = await prisma.room.findFirst({
    where: {
      OR: [{ roomCode: roomId }, { customSlug: roomId }]
    },
    include: {
      host: { select: { plan: true } },
      _count: { select: { messages: true } }
    }
  });

  if (!room) return null;

  const activeTier = room.isPassUsed ? 'ROOM_PASS' : (room.host.plan || 'SOLO');
  const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

  const roomData = {
    id: room.id,
    roomCode: room.roomCode,
    customSlug: room.customSlug,
    startsAt: new Date(room.startsAt),
    expiresAt: new Date(room.expiresAt),
    isAccepting: room.isAccepting,
    isPassUsed: room.isPassUsed,
    hostPlan: room.host.plan,
    activeTier,
    limits,
    maxMessagesAllowed: limits.maxMessages,
    tierName: activeTier === "SOLO" ? "free tier" : activeTier,
    dbMessageCount: room._count.messages
  };

  activeRoomCache.set(room.roomCode, roomData);
  if (room.customSlug) {
    activeRoomCache.set(room.customSlug, roomData);
  }

  return roomData;
}

//Send message to a specific room (RAM-First: < 2ms)
app.post("/api/rooms/public/:roomId/messages", messageSubmissionLimiter, async (req, res) => {
  const { roomId } = req.params
  const content = req.body.content || req.body.text;
  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Message is required" })
  }
  if (content.length > 300) {
    return res.status(400).json({ message: "Message exceeds 300 characters" })
  }
  if (roomId.toLowerCase() === "demo") {
    const demoMsg = {
      id: "demo-" + Date.now(),
      content: content.trim(),
      guestName: "Anonymous",
      createdAt: new Date().toISOString()
    };
    return res.status(201).json({
      message: "Message sent successfully (Demo)",
      newMessage: demoMsg,
      data: demoMsg
    });
  }
  try {
    const room = await getOrHydrateActiveRoom(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }
    const canonicalRoomCode = room.roomCode;

    // Check plan message limit from RAM
    const limits = room.limits;
    const maxMessagesAllowed = room.maxMessagesAllowed;
    const tierName = room.tierName;

    const cached = roomMessagesCache.get(canonicalRoomCode);
    const currentCount = cached ? cached.messageCount : (room.dbMessageCount || 0);

    if (currentCount >= maxMessagesAllowed) {
      room.isAccepting = false;
      // Automatically end session in database asynchronously
      (async () => {
        try {
          await prisma.room.update({
            where: { id: room.id },
            data: { isAccepting: false, expiresAt: new Date() }
          });
        } catch (e) {}
      })();
      evictRoomMessagesCache(canonicalRoomCode);
      activeRoomCache.delete(canonicalRoomCode);
      if (room.customSlug) activeRoomCache.delete(room.customSlug);
      const capacityReason = `This room has reached its ${tierName} limit of ${maxMessagesAllowed} messages and has automatically ended.`;
      await notifyRoomEnded(canonicalRoomCode, room.id, capacityReason);
      return res.status(403).json({
        message: capacityReason,
        isExpired: true
      });
    }

    const now = new Date()
    if (now < room.startsAt) {
      return res.status(400).json({ message: "Session has not started yet" })
    }
    if (now > room.expiresAt) {
      return res.status(400).json({ message: "Session has expired" })
    }
    if (!room.isAccepting) {
      return res.status(400).json({ message: "Session is not accepting messages" })
    }

    const metadata = parseClientMetadata(req);
    const clientDeviceModel = req.body.clientDeviceModel && typeof req.body.clientDeviceModel === "string" && req.body.clientDeviceModel.toUpperCase() !== "K"
      ? req.body.clientDeviceModel.trim().slice(0, 100)
      : null;
    const finalDeviceModel = clientDeviceModel || (metadata.deviceModel ? String(metadata.deviceModel).slice(0, 100) : null);

    // 1. Instant Baseline Content & Toxicity Check (< 0.1ms, zero latency)
    const localTox = fastCheckLocal(content.trim());
    let aiFlagged = localTox.isFlagged;
    let aiFlagReason = localTox.reason;
    let aiCategory = localTox.category;
    let messageStatus = aiFlagged ? "rejected" : "accepted";

    // 2. Generate a temporary in-memory message object with a UUID (< 1ms)
    const tempId = crypto.randomUUID();
    const msgData = {
      id: tempId,
      roomId: room.id,
      content: content.trim(),
      status: messageStatus,
      upvotes: 0,
      isAnswered: false,
      isPinned: false,
      hostReply: null,
      aiFlagged,
      aiFlagReason,
      aiCategory,
      device: metadata.device,
      deviceModel: finalDeviceModel,
      location: metadata.location,
      ipAddress: metadata.ipAddress,
      createdAt: now
    };

    // 3. Instantly insert into in-memory cache (< 1ms)
    if (cached) {
      cached.messages.set(tempId, msgData);
      cached.messageCount += 1;
    } else {
      const freshCache = await getOrHydrateRoomMessages(canonicalRoomCode);
      if (freshCache) {
        freshCache.messages.set(tempId, msgData);
        freshCache.messageCount += 1;
      }
    }

    // 4. Instant WebSocket broadcast (< 1ms)
    const publicMsg = buildPublicMessage(msgData);
    io.to(canonicalRoomCode).emit("new_message", publicMsg);
    if (room.customSlug && room.customSlug !== canonicalRoomCode) {
      io.to(room.customSlug).emit("new_message", publicMsg);
    }

    // 5. Immediate HTTP response to client (sub-10ms response time)
    res.status(201).json({
      message: aiFlagged ? "Message submitted" : "Message sent successfully",
      newMessage: publicMsg,
      data: {
        id: tempId,
        createdAt: now
      }
    });

    // 6. Asynchronously persist to PostgreSQL and run Cloud Gemini AI check in the background
    (async () => {
      try {
        let finalStatus = messageStatus;
        let finalAiFlagged = aiFlagged;
        let finalAiReason = aiFlagReason;
        let finalAiCategory = aiCategory;

        // If not already flagged by fast local rules, run Cloud Gemini 1.5 Flash Deep Check
        if (!finalAiFlagged && (limits.canAiModeration || Boolean(process.env.GEMINI_API_KEY))) {
          try {
            const deepCheck = await checkToxicity(content.trim());
            if (deepCheck && deepCheck.isFlagged) {
              finalAiFlagged = true;
              finalAiReason = deepCheck.reason || "Flagged by AI moderation";
              finalAiCategory = deepCheck.category || "Toxicity";
              finalStatus = "rejected";

              // Update in-memory cache
              const currentCache = roomMessagesCache.get(canonicalRoomCode);
              if (currentCache && currentCache.messages.has(tempId)) {
                const memMsg = currentCache.messages.get(tempId);
                memMsg.status = "rejected";
                memMsg.aiFlagged = true;
                memMsg.aiFlagReason = finalAiReason;
                memMsg.aiCategory = finalAiCategory;
              }

              // Real-time broadcast to hide from Stage and Public Feed immediately
              const statusPayload = {
                messageId: tempId,
                status: "rejected",
                aiFlagged: true,
                aiFlagReason: finalAiReason,
                aiCategory: finalAiCategory
              };
              io.to(canonicalRoomCode).emit("message_status_changed", statusPayload);
              if (room.customSlug && room.customSlug !== canonicalRoomCode) {
                io.to(room.customSlug).emit("message_status_changed", statusPayload);
              }
            }
          } catch (cloudErr) {
            console.warn("Background AI moderation check error:", cloudErr.message);
          }
        }

        const dbMessage = await prisma.message.create({
          data: {
            id: tempId,
            roomId: room.id,
            content: content.trim(),
            status: finalStatus,
            aiFlagged: finalAiFlagged,
            aiFlagReason: finalAiReason,
            aiCategory: finalAiCategory,
            device: metadata.device,
            deviceModel: finalDeviceModel,
            location: metadata.location,
            ipAddress: metadata.ipAddress,
          }
        });

        // Ensure cache timestamp is synced
        const currentCache = roomMessagesCache.get(canonicalRoomCode);
        if (currentCache && currentCache.messages.has(tempId)) {
          const msg = currentCache.messages.get(tempId);
          msg.createdAt = dbMessage.createdAt;
        }

        // Check if this message hits the capacity limit and end session
        const updatedCount = currentCache ? currentCache.messageCount : (room._count.messages + 1);
        if (updatedCount >= maxMessagesAllowed) {
          await prisma.room.update({
            where: { id: room.id },
            data: { isAccepting: false, expiresAt: new Date() }
          });
          console.log(`Room ${canonicalRoomCode} reached ${tierName} capacity (${maxMessagesAllowed} messages). Session automatically ended.`);
          const capacityReason = `This room has reached its ${tierName} limit of ${maxMessagesAllowed} messages and has automatically ended.`;
          await notifyRoomEnded(canonicalRoomCode, room.id, capacityReason);
          evictRoomMessagesCache(canonicalRoomCode);
        }
      } catch (dbErr) {
        console.error("Background DB message write error:", dbErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==========================================================================
//   IN-MEMORY MESSAGE CACHE — Ultra-Low Latency Q&A Feed
//   Same architecture as live polls: RAM-first reads, instant socket
//   broadcasts, async background DB writeback.
// ==========================================================================

const roomMessagesCache = new Map(); // roomCode -> { roomDbId, messages: Map<id, msg>, messageCount, hydrated }

/**
 * Build a public-safe message object (strips internal fields like ipAddress).
 */
function buildPublicMessage(msg) {
  return {
    id: msg.id,
    content: msg.content,
    status: msg.status || "accepted",
    upvotes: msg.upvotes,
    isAnswered: msg.isAnswered,
    isPinned: msg.isPinned,
    hostReply: msg.hostReply,
    aiFlagged: Boolean(msg.aiFlagged),
    aiFlagReason: msg.aiFlagReason || null,
    aiCategory: msg.aiCategory || null,
    createdAt: msg.createdAt
  };
}

/**
 * Build a host-facing message (includes device/location metadata).
 */
function buildHostMessage(msg) {
  return {
    id: msg.id,
    roomId: msg.roomId,
    content: msg.content,
    status: msg.status,
    upvotes: msg.upvotes,
    isAnswered: msg.isAnswered,
    isPinned: msg.isPinned,
    hostReply: msg.hostReply,
    aiFlagged: Boolean(msg.aiFlagged),
    aiFlagReason: msg.aiFlagReason || null,
    aiCategory: msg.aiCategory || null,
    device: msg.device,
    deviceModel: msg.deviceModel,
    location: msg.location,
    ipAddress: msg.ipAddress,
    createdAt: msg.createdAt
  };
}

/**
 * Get or hydrate the message cache for a room from PostgreSQL.
 * After first call, all subsequent reads are 0ms from RAM.
 */
async function getOrHydrateRoomMessages(roomCode) {
  if (roomMessagesCache.has(roomCode)) {
    return roomMessagesCache.get(roomCode);
  }

  // Hydrate from database
  const room = await prisma.room.findFirst({
    where: { roomCode },
    select: { id: true }
  });
  if (!room) return null;

  const dbMessages = await prisma.message.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "desc" }
  });

  const messagesMap = new Map();
  for (const m of dbMessages) {
    messagesMap.set(m.id, {
      id: m.id,
      roomId: m.roomId,
      content: m.content,
      status: m.status || "accepted",
      upvotes: m.upvotes || 0,
      isAnswered: m.isAnswered || false,
      isPinned: m.isPinned || false,
      hostReply: m.hostReply || null,
      device: m.device,
      deviceModel: m.deviceModel,
      location: m.location,
      ipAddress: m.ipAddress,
      createdAt: m.createdAt
    });
  }

  const cached = {
    roomDbId: room.id,
    messages: messagesMap,
    messageCount: messagesMap.size,
    hydrated: true
  };

  roomMessagesCache.set(roomCode, cached);
  return cached;
}

/**
 * Get sorted public messages from cache (pinned first, then by upvotes, then newest).
 */
function getSortedPublicMessages(cached) {
  const msgs = Array.from(cached.messages.values())
    .filter(m => m.status !== "rejected")
    .map(buildPublicMessage)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  return msgs;
}

/**
 * Get sorted host messages from cache (newest first).
 */
function getSortedHostMessages(cached) {
  return Array.from(cached.messages.values())
    .map(buildHostMessage)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Evict message cache for a room (called on session end / room delete).
 */
function evictRoomMessagesCache(roomCode) {
  roomMessagesCache.delete(roomCode);
}

/**
 * Notify everyone when a room session ends:
 *  - Broadcasts `session_ended` to all sockets in the room channel (guests, host, co-hosts)
 *  - Sends `collaborator_room_closed` to each co-host's personal channel so their
 *    dashboards update in real-time without requiring a page refresh.
 *
 * @param {string} roomCode  - The short room code used as the socket room name
 * @param {string} roomDbId  - The Prisma UUID for DB lookup of collaborators
 * @param {string} [reason]  - Optional human-readable reason string
 */
async function notifyRoomEnded(roomCode, roomDbId, reason) {
  const payload = reason ? { roomCode, reason } : { roomCode };
  io.to(roomCode).emit("session_ended", payload);
  try {
    const collaborators = await prisma.roomCollaborator.findMany({
      where: { roomId: roomDbId },
      select: { userId: true }
    });
    for (const c of collaborators) {
      io.to(`user_${c.userId}`).emit("collaborator_room_closed", { roomCode, roomId: roomDbId });
    }
  } catch (err) {
    console.error("Failed to notify collaborators on session end:", err);
  }
}

//upvote / toggle vote messages (Cache-First: < 2ms)
app.patch("/api/rooms/:roomId/messages/:messageId/upvote", async (req, res) => {
  const { roomId, messageId } = req.params
  const { action } = req.body || {}
  const isDecrement = action === "downvote" || action === "unvote"
  try {
    // 1. Fast-path: Try in-memory cache first (< 1ms)
    const cached = await getOrHydrateRoomMessages(roomId);
    if (cached) {
      const msg = cached.messages.get(messageId);
      if (msg) {
        // Instant in-memory mutation
        msg.upvotes = isDecrement ? Math.max(0, msg.upvotes - 1) : msg.upvotes + 1;

        // Instant WebSocket broadcast (< 2ms)
        io.to(roomId).emit("message_upvoted", {
          messageId: msg.id,
          upvotes: msg.upvotes
        });

        // Immediate HTTP response
        res.json({ message: "Vote updated successfully", upvotes: msg.upvotes });

        // Background DB writeback (non-blocking) — use increment/decrement to avoid race conditions
        (async () => {
          try {
            await prisma.message.update({
              where: { id: messageId },
              data: { upvotes: isDecrement ? { decrement: 1 } : { increment: 1 } }
            });
          } catch (dbErr) {
            console.error("Background DB upvote write error:", dbErr.message);
          }
        })();
        return;
      }
    }

    // Fallback: DB-first if cache miss (scope message lookup to this room)
    const room = await prisma.room.findFirst({ where: { roomCode: roomId }, select: { id: true } });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const current = await prisma.message.findFirst({ where: { id: messageId, roomId: room.id } });
    if (!current) return res.status(404).json({ message: "Message not found in this room" });

    const newUpvotes = isDecrement ? Math.max(0, current.upvotes - 1) : current.upvotes + 1;

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { upvotes: newUpvotes }
    });
    io.to(roomId).emit("message_upvoted", {
      messageId: updatedMessage.id,
      upvotes: updatedMessage.upvotes
    })
    res.json({ message: "Vote updated successfully", upvotes: updatedMessage.upvotes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Toggle message answered status (Cache-First: < 2ms)
app.patch("/api/rooms/:roomId/messages/:messageId/answered", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params
  const { isAnswered } = req.body || {}
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    const targetMessage = await prisma.message.findFirst({
      where: { id: messageId, roomId: room.id },
      select: { id: true }
    });
    if (!targetMessage) return res.status(404).json({ message: "Message not found in this room" });

    const answeredVal = Boolean(isAnswered);

    // 1. Instant in-memory mutation
    const cached = roomMessagesCache.get(roomId);
    if (cached) {
      const msg = cached.messages.get(messageId);
      if (msg) {
        msg.isAnswered = answeredVal;
      }
    }

    // 2. Instant WebSocket broadcast
    io.to(roomId).emit("message_answered", {
      messageId,
      isAnswered: answeredVal
    });

    // 3. Immediate HTTP response
    res.json({ message: "Answered status updated successfully", messageItem: { id: messageId, isAnswered: answeredVal } });

    // 4. Background DB writeback
    (async () => {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: { isAnswered: answeredVal }
        });
      } catch (dbErr) {
        console.error("Background DB answered write error:", dbErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Host updates room settings (e.g. toggle audience visibility of Q&A feed, activity mode, question acceptance)
app.patch("/api/rooms/:roomId/settings", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { showPublicFeed, isAccepting, activityType } = req.body;
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }
    const updateData = {};
    if (typeof showPublicFeed === "boolean") updateData.showPublicFeed = showPublicFeed;
    if (typeof isAccepting === "boolean") updateData.isAccepting = isAccepting;
    if (activityType && ["ALL", "POLL", "WORD_CLOUD", "QA"].includes(activityType)) {
      updateData.activityType = activityType;
    }

    const updated = await prisma.room.update({
      where: { id: room.id },
      data: updateData
    });

    io.to(roomId).emit("room_settings_updated", {
      roomCode: roomId,
      showPublicFeed: updated.showPublicFeed,
      isAccepting: updated.isAccepting,
      activityType: updated.activityType
    });

    res.json({ message: "Settings updated successfully", room: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Fetch approved questions for audience feed (Cache-First: 0ms)
app.get("/api/rooms/public/:roomId/messages", async (req, res) => {
  const { roomId } = req.params;
  if (roomId.toLowerCase() === "demo") {
    return res.json({
      showPublicFeed: true,
      messages: [
        {
          id: "demo-q1",
          content: "How does WhisprLive guarantee 100% attendee anonymity?",
          upvotes: 14,
          isAnswered: true,
          isPinned: true,
          hostReply: "Attendees never register or sign in. Messages are assigned random IDs and no personal info is ever stored or shared!",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "demo-q2",
          content: "Can we use WhisprLive with large audiences over 500+ participants?",
          upvotes: 9,
          isAnswered: false,
          isPinned: false,
          hostReply: null,
          createdAt: new Date(Date.now() - 1800000).toISOString()
        },
        {
          id: "demo-q3",
          content: "Is there support for interactive audience polls during the talk?",
          upvotes: 6,
          isAnswered: true,
          isPinned: false,
          hostReply: "Yes! Hosts can launch live multiple-choice polls and real-time word clouds at any point.",
          createdAt: new Date(Date.now() - 900000).toISOString()
        }
      ]
    });
  }

  try {
    // Fast-path: Check if room's public feed setting is cached
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId },
      select: { id: true, showPublicFeed: true }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.showPublicFeed) {
      return res.json({ showPublicFeed: false, messages: [] });
    }

    // Serve from in-memory cache (0ms) if available
    const cached = await getOrHydrateRoomMessages(roomId);
    if (cached) {
      return res.json({ showPublicFeed: true, messages: getSortedPublicMessages(cached) });
    }

    // Fallback to direct DB query if hydration failed
    const messages = await prisma.message.findMany({
      where: {
        roomId: room.id,
        status: { not: "rejected" }
      },
      select: {
        id: true,
        content: true,
        upvotes: true,
        isAnswered: true,
        isPinned: true,
        hostReply: true,
        createdAt: true,
      },
      orderBy: [
        { isPinned: "desc" },
        { upvotes: "desc" },
        { createdAt: "desc" }
      ]
    });

    res.json({ showPublicFeed: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Host adds / updates an official direct answer / reply to a question (Cache-First: < 2ms)
app.patch("/api/rooms/:roomId/messages/:messageId/reply", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params;
  const { hostReply } = req.body;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }
    const targetMessage = await prisma.message.findFirst({
      where: { id: messageId, roomId: room.id },
      select: { id: true }
    });
    if (!targetMessage) return res.status(404).json({ message: "Message not found in this room" });

    const cleanReply = typeof hostReply === "string" ? hostReply.trim() : null;
    const isAnswered = Boolean(cleanReply);

    // 1. Instant in-memory mutation
    const cached = roomMessagesCache.get(roomId);
    if (cached) {
      const msg = cached.messages.get(messageId);
      if (msg) {
        msg.hostReply = cleanReply || null;
        if (isAnswered) msg.isAnswered = true;
      }
    }

    // 2. Instant WebSocket broadcast
    io.to(roomId).emit("message_replied", {
      messageId,
      hostReply: cleanReply || null,
      isAnswered
    });

    // 3. Immediate HTTP response
    res.json({ message: "Host reply saved successfully", messageItem: { id: messageId, hostReply: cleanReply || null, isAnswered } });

    // 4. Background DB writeback
    (async () => {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: {
            hostReply: cleanReply || null,
            isAnswered: isAnswered ? true : undefined
          }
        });
      } catch (dbErr) {
        console.error("Background DB reply write error:", dbErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Host toggles pinning a question to the top (Cache-First: < 2ms)
app.patch("/api/rooms/:roomId/messages/:messageId/pin", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params;
  const { isPinned } = req.body;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }
    const targetMessage = await prisma.message.findFirst({
      where: { id: messageId, roomId: room.id },
      select: { id: true }
    });
    if (!targetMessage) return res.status(404).json({ message: "Message not found in this room" });

    const pinnedVal = Boolean(isPinned);

    // 1. Instant in-memory mutation
    const cached = roomMessagesCache.get(roomId);
    if (cached) {
      const msg = cached.messages.get(messageId);
      if (msg) {
        msg.isPinned = pinnedVal;
      }
    }

    // 2. Instant WebSocket broadcast
    io.to(roomId).emit("message_pinned", {
      messageId,
      isPinned: pinnedVal
    });

    // 3. Immediate HTTP response
    res.json({ message: "Pin status updated successfully", messageItem: { id: messageId, isPinned: pinnedVal } });

    // 4. Background DB writeback
    (async () => {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: { isPinned: pinnedVal }
        });
      } catch (dbErr) {
        console.error("Background DB pin write error:", dbErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Host deletes/rejects a message (Cache-First: < 2ms)
app.delete("/api/rooms/:roomId/messages/:messageId", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }
    const targetMessage = await prisma.message.findFirst({
      where: { id: messageId, roomId: room.id },
      select: { id: true }
    });
    if (!targetMessage) return res.status(404).json({ message: "Message not found in this room" });

    // 1. Instant in-memory cache eviction
    const canonicalRoomCode = room.roomCode;
    const cached = roomMessagesCache.get(canonicalRoomCode);
    if (cached) {
      cached.messages.delete(messageId);
      cached.messageCount = Math.max(0, cached.messageCount - 1);
    }

    // 2. Instant WebSocket broadcast to remove from all attendee feeds, stage, and host dashboard
    io.to(canonicalRoomCode).emit("message_deleted", { messageId });
    if (room.customSlug && room.customSlug !== canonicalRoomCode) {
      io.to(room.customSlug).emit("message_deleted", { messageId });
    }

    // 3. Immediate HTTP response
    res.json({ message: "Message deleted successfully", messageId });

    // 4. Background DB deletion
    (async () => {
      try {
        await prisma.message.delete({
          where: { id: messageId }
        });
      } catch (dbErr) {
        console.error("Background DB message delete error:", dbErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In-Memory Fast Cache for Ultra-Low Latency Live Polls & Word Clouds
const activePollCache = new Map();
const roomToActivePollId = new Map();

function buildPublicPoll(cached) {
  if (!cached) return null;
  return {
    id: cached.id,
    roomId: cached.roomId,
    roomCode: cached.roomCode,
    question: cached.question,
    type: cached.type,
    isActive: cached.isActive,
    isQuiz: cached.isQuiz || false,
    quizTimerSeconds: cached.quizTimerSeconds || 0,
    isQuizRevealed: cached.isQuizRevealed || false,
    totalVotes: cached.totalVotes,
    options: cached.options,
    wordCloud: cached.wordCloud,
    createdAt: cached.createdAt
  };
}

async function getOrHydrateActivePoll(roomIdOrCode, pollId) {
  if (pollId && activePollCache.has(pollId)) {
    return activePollCache.get(pollId);
  }
  if (!pollId && roomToActivePollId.has(roomIdOrCode)) {
    const pId = roomToActivePollId.get(roomIdOrCode);
    if (activePollCache.has(pId)) {
      return activePollCache.get(pId);
    }
  }

  const whereClause = pollId
    ? { id: pollId }
    : { room: { OR: [{ roomCode: roomIdOrCode }, { customSlug: roomIdOrCode }] }, isActive: true };

  const poll = await prisma.poll.findFirst({
    where: whereClause,
    include: {
      room: { select: { roomCode: true, customSlug: true, id: true } },
      options: {
        orderBy: { id: "asc" }
      },
      responses: true
    }
  });

  if (!poll) return null;

  const totalVotes = poll.responses.length;
  let formattedOptions = [];
  if (poll.type === "CHOICE") {
    formattedOptions = poll.options.map((opt) => {
      const optVotes = poll.responses.filter((r) => r.optionId === opt.id).length;
      const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        text: opt.text,
        votes: optVotes,
        percentage,
        isCorrect: poll.isQuizRevealed ? opt.isCorrect : undefined,
      };
    });
  }

  const wordMap = {};
  let wordCloud = [];
  if (poll.type === "WORD_CLOUD") {
    poll.responses.forEach((r) => {
      if (r.word) {
        const clean = r.word.trim().toLowerCase();
        wordMap[clean] = (wordMap[clean] || 0) + 1;
      }
    });
    wordCloud = Object.entries(wordMap)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count);
  }

  const voters = new Set(poll.responses.map((r) => r.voterId));

  const cached = {
    id: poll.id,
    roomId: poll.roomId,
    roomCode: poll.room?.roomCode || roomIdOrCode,
    question: poll.question,
    type: poll.type,
    isActive: poll.isActive,
    isQuiz: poll.isQuiz || false,
    quizTimerSeconds: poll.quizTimerSeconds || 0,
    isQuizRevealed: poll.isQuizRevealed || false,
    totalVotes,
    options: formattedOptions,
    wordCloud,
    wordMap,
    voters,
    createdAt: poll.createdAt
  };

  if (poll.isActive) {
    activePollCache.set(poll.id, cached);
    if (poll.room?.roomCode) {
      roomToActivePollId.set(poll.room.roomCode, poll.id);
    }
    if (poll.room?.customSlug) {
      roomToActivePollId.set(poll.room.customSlug, poll.id);
    }
  }

  return cached;
}

// Helper to format active poll with live aggregates (percentages / word clouds)
async function formatActivePoll(pollId) {
  const cached = await getOrHydrateActivePoll(null, pollId);
  return buildPublicPoll(cached);
}

// Host creates a new Live Poll / Quiz / Word Cloud prompt
app.post("/api/rooms/:roomId/polls", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { question, type, options, isQuiz, quizTimerSeconds } = req.body;

  if (!question || question.trim() === "") {
    return res.status(400).json({ message: "Poll question/prompt is required" });
  }
  if (question.length > 200) {
    return res.status(400).json({ message: "Poll question must be 200 characters or fewer" });
  }
  if (Array.isArray(options)) {
    const tooLong = options.some((o) => {
      const txt = typeof o === "string" ? o : (o?.text || "");
      return txt.length > 100;
    });
    if (tooLong) return res.status(400).json({ message: "Poll option text must be 100 characters or fewer" });
  }
  const pollType = type === "WORD_CLOUD" ? "WORD_CLOUD" : "CHOICE";

  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const activeTier = room.isPassUsed ? "ROOM_PASS" : (user?.plan || "SOLO");
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    // Check Live Quiz permission
    const isQuizMode = Boolean(isQuiz);
    if (isQuizMode && !limits.canQuiz) {
      return res.status(403).json({
        message: "Live Quiz Mode with countdowns and leaderboards is available on 24h Room Pass, Host, and Studio plans."
      });
    }

    // Deactivate previous active poll in memory cache
    const canonicalRoomCode = room.roomCode;
    const prevPollId = roomToActivePollId.get(canonicalRoomCode) || roomToActivePollId.get(roomId);
    if (prevPollId && activePollCache.has(prevPollId)) {
      activePollCache.get(prevPollId).isActive = false;
      activePollCache.delete(prevPollId);
    }
    roomToActivePollId.delete(canonicalRoomCode);
    if (room.customSlug) roomToActivePollId.delete(room.customSlug);

    // Automatically deactivate previous active polls in this room in DB
    await prisma.poll.updateMany({
      where: { roomId: room.id, isActive: true },
      data: { isActive: false }
    });

    const parsedOptions = Array.isArray(options) ? options.map(opt => {
      if (typeof opt === "string") {
        return { text: opt.trim(), isCorrect: false, votes: 0 };
      }
      return {
        text: (opt.text || "").trim(),
        isCorrect: Boolean(opt.isCorrect),
        votes: 0
      };
    }).filter(o => o.text !== "") : [];

    const newPoll = await prisma.poll.create({
      data: {
        roomId: room.id,
        question: question.trim(),
        type: pollType,
        isActive: true,
        isQuiz: isQuizMode,
        quizTimerSeconds: parseInt(quizTimerSeconds, 10) || 0,
        isQuizRevealed: false,
        options: pollType === "CHOICE" && parsedOptions.length > 0 ? {
          create: parsedOptions.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            votes: 0
          }))
        } : undefined
      },
      include: {
        options: { orderBy: { id: "asc" } },
        responses: true
      }
    });

    // Populate memory cache instantly
    const initialOptions = (newPoll.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
      votes: 0,
      percentage: 0,
      isCorrect: opt.isCorrect,
    }));

    const cached = {
      id: newPoll.id,
      roomId: newPoll.roomId,
      roomCode: canonicalRoomCode,
      question: newPoll.question,
      type: newPoll.type,
      isActive: true,
      isQuiz: newPoll.isQuiz,
      quizTimerSeconds: newPoll.quizTimerSeconds,
      isQuizRevealed: false,
      totalVotes: 0,
      options: initialOptions,
      wordCloud: [],
      wordMap: {},
      voters: new Set(),
      createdAt: newPoll.createdAt
    };

    activePollCache.set(newPoll.id, cached);
    roomToActivePollId.set(canonicalRoomCode, newPoll.id);
    if (room.customSlug) roomToActivePollId.set(room.customSlug, newPoll.id);

    const formatted = buildPublicPoll(cached);
    io.to(canonicalRoomCode).emit("poll_created", formatted);
    if (room.customSlug && room.customSlug !== canonicalRoomCode) {
      io.to(room.customSlug).emit("poll_created", formatted);
    }

    res.status(201).json({ message: "Poll created successfully", poll: formatted });
  } catch (err) {
    console.error("Poll creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Public / Host: Get current active poll for the room
app.get("/api/rooms/public/:roomId/poll/active", async (req, res) => {
  const { roomId } = req.params;
  if (roomId.toLowerCase() === "demo") {
    return res.json({
      poll: {
        id: "demo-poll",
        roomId: "demo",
        question: "How are you planning to use WhisprLive?",
        type: "CHOICE",
        isActive: true,
        totalVotes: 42,
        options: [
          { id: "opt-1", text: "Conferences & Events", votes: 21, percentage: 50 },
          { id: "opt-2", text: "Company All-Hands / Town Halls", votes: 13, percentage: 31 },
          { id: "opt-3", text: "College Classes & Workshops", votes: 8, percentage: 19 }
        ],
        wordCloud: [],
        createdAt: new Date().toISOString()
      }
    });
  }

  // Fast-path: Check memory cache first (0ms)
  if (roomToActivePollId.has(roomId)) {
    const pId = roomToActivePollId.get(roomId);
    const cached = activePollCache.get(pId);
    if (cached && cached.isActive) {
      return res.json({ poll: buildPublicPoll(cached) });
    }
  }

  try {
    const cached = await getOrHydrateActivePoll(roomId, null);
    res.json({ poll: buildPublicPoll(cached) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public Audience: Cast a vote or submit a word (Instant sub-10ms response + WebSocket broadcast)
app.post("/api/rooms/public/:roomId/poll/:pollId/vote", pollVoteLimiter, async (req, res) => {
  const { roomId, pollId } = req.params;
  const { optionId, word } = req.body;
  const voterId = req.body.voterId || req.body.guestId;

  if (!voterId) {
    return res.status(400).json({ message: "Voter ID is required" });
  }

  if (roomId.toLowerCase() === "demo" || pollId === "demo-poll") {
    return res.json({ message: "Vote recorded (Demo)" });
  }

  try {
    let cached = await getOrHydrateActivePoll(roomId, pollId);

    if (!cached || !cached.isActive || cached.roomCode !== roomId) {
      return res.status(400).json({ message: "Poll is not active or unavailable" });
    }

    // 1. Ultra-fast in-memory duplicate vote check (0ms)
    if (cached.voters.has(voterId)) {
      return res.status(400).json({ message: "You have already participated in this poll" });
    }

    // 2. Instant In-Memory State Mutation (< 1ms)
    cached.voters.add(voterId);
    cached.totalVotes += 1;

    if (cached.type === "CHOICE" && optionId) {
      const opt = cached.options.find((o) => o.id === optionId);
      if (opt) {
        opt.votes += 1;
      }
      cached.options.forEach((o) => {
        o.percentage = cached.totalVotes > 0 ? Math.round((o.votes / cached.totalVotes) * 100) : 0;
      });
    } else if (cached.type === "WORD_CLOUD" && word) {
      const clean = word.trim().toLowerCase().slice(0, 30);
      if (clean) {
        cached.wordMap[clean] = (cached.wordMap[clean] || 0) + 1;
        cached.wordCloud = Object.entries(cached.wordMap)
          .map(([text, count]) => ({ text, count }))
          .sort((a, b) => b.count - a.count);
      }
    }

    const publicPoll = buildPublicPoll(cached);

    // 3. INSTANT WEBSOCKET BROADCAST to Host & All Participants (< 5ms)
    io.to(roomId).emit("poll_updated", publicPoll);

    // 4. Return HTTP response immediately (Audience sees confirmation in < 15ms)
    res.json({ message: "Vote recorded successfully", poll: publicPoll });

    // 5. Asynchronously persist to Postgres in the background without blocking the socket or response
    (async () => {
      try {
        await prisma.pollResponse.create({
          data: {
            pollId,
            optionId: optionId || null,
            word: word && typeof word === "string" ? word.trim().slice(0, 30) : null,
            voterId
          }
        });
        if (optionId) {
          await prisma.pollOption.update({
            where: { id: optionId },
            data: { votes: { increment: 1 } }
          }).catch(() => {});
        }
      } catch (dbErr) {
        console.error("Background DB vote write error:", dbErr.message);
      }
    })();
  } catch (err) {
    console.error("Poll vote error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Host ends active poll
app.patch("/api/rooms/:roomId/polls/:pollId/end", verifyToken, async (req, res) => {
  const { roomId, pollId } = req.params;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    const room = access?.room;
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }
    const targetPoll = await prisma.poll.findFirst({
      where: { id: pollId, roomId: room.id },
      select: { id: true }
    });
    if (!targetPoll) return res.status(404).json({ message: "Poll not found in this room" });

    // Invalidate in-memory cache immediately (< 1ms)
    if (activePollCache.has(pollId)) {
      activePollCache.get(pollId).isActive = false;
      activePollCache.delete(pollId);
    }
    roomToActivePollId.delete(roomId);

    // Instantly notify everyone that poll has ended
    io.to(roomId).emit("poll_ended", { pollId });

    // Persist status in DB
    await prisma.poll.update({
      where: { id: pollId },
      data: { isActive: false }
    });

    res.json({ message: "Poll ended successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POLL DRAFTS & TEMPLATES LIBRARY ---

// Host: Get all saved poll templates
app.get("/api/poll-templates", verifyToken, async (req, res) => {
  try {
    const templates = await prisma.pollTemplate.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" }
    });
    res.json({ templates });
  } catch (err) {
    console.error("Get poll templates error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Host: Create a new poll template/draft
app.post("/api/poll-templates", verifyToken, async (req, res) => {
  const { title, question, type, options } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ message: "Question/prompt is required" });
  }
  const pollType = type === "WORD_CLOUD" ? "WORD_CLOUD" : "CHOICE";
  const validOptions = pollType === "CHOICE" && Array.isArray(options)
    ? options.filter((o) => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
    : [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, roomPasses: true }
    });

    const isPaidOrPass = (user?.plan && user.plan !== "SOLO") || (user?.roomPasses || 0) > 0;
    const maxTemplates = isPaidOrPass ? Infinity : (PLAN_LIMITS.SOLO.maxPollTemplates || 2);

    if (maxTemplates !== Infinity) {
      const templateCount = await prisma.pollTemplate.count({
        where: { userId: req.user.id }
      });
      if (templateCount >= maxTemplates) {
        return res.status(403).json({
          message: `Free Solo plan includes up to ${maxTemplates} saved templates in your library. Upgrade or get a Room Pass to save unlimited poll templates.`
        });
      }
    }

    const template = await prisma.pollTemplate.create({
      data: {
        userId: req.user.id,
        title: title && title.trim() ? title.trim() : null,
        question: question.trim(),
        type: pollType,
        options: validOptions
      }
    });
    res.status(201).json({ message: "Poll template saved successfully", template });
  } catch (err) {
    console.error("Create poll template error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Host: Update an existing poll template/draft
app.put("/api/poll-templates/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, question, type, options } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ message: "Question/prompt is required" });
  }
  const pollType = type === "WORD_CLOUD" ? "WORD_CLOUD" : "CHOICE";
  const validOptions = pollType === "CHOICE" && Array.isArray(options)
    ? options.filter((o) => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
    : [];

  try {
    const existing = await prisma.pollTemplate.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!existing) {
      return res.status(404).json({ message: "Template not found or unauthorized" });
    }

    const updated = await prisma.pollTemplate.update({
      where: { id },
      data: {
        title: title && title.trim() ? title.trim() : null,
        question: question.trim(),
        type: pollType,
        options: validOptions
      }
    });
    res.json({ message: "Poll template updated successfully", template: updated });
  } catch (err) {
    console.error("Update poll template error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Host: Delete a poll template
app.delete("/api/poll-templates/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, roomPasses: true }
    });

    const isPaidOrPass = (user?.plan && user.plan !== "SOLO") || (user?.roomPasses || 0) > 0;
    if (!isPaidOrPass) {
      return res.status(403).json({
        message: "Deleting poll templates is reserved for paid plans or Room Pass holders. Upgrade to manage and delete templates."
      });
    }

    const template = await prisma.pollTemplate.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    await prisma.pollTemplate.delete({ where: { id } });
    res.json({ message: "Poll template deleted successfully" });
  } catch (err) {
    console.error("Delete poll template error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Host: 1-Click Launch a saved template into an active room
app.post("/api/rooms/:roomId/polls/launch-template/:templateId", verifyToken, async (req, res) => {
  const { roomId, templateId } = req.params;
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    const template = await prisma.pollTemplate.findFirst({
      where: { id: templateId, userId: req.user.id }
    });
    if (!template) {
      return res.status(404).json({ message: "Poll template not found" });
    }

    // Deactivate previous active poll in memory cache
    const prevPollId = roomToActivePollId.get(roomId);
    if (prevPollId && activePollCache.has(prevPollId)) {
      activePollCache.get(prevPollId).isActive = false;
      activePollCache.delete(prevPollId);
    }
    roomToActivePollId.delete(roomId);

    // Deactivate previous active polls in DB
    await prisma.poll.updateMany({
      where: { roomId: room.id, isActive: true },
      data: { isActive: false }
    });

    const newPoll = await prisma.poll.create({
      data: {
        roomId: room.id,
        question: template.question,
        type: template.type,
        isActive: true,
        options: template.type === "CHOICE" && template.options.length > 0 ? {
          create: template.options.map((optText) => ({
            text: optText,
            votes: 0
          }))
        } : undefined
      },
      include: {
        options: { orderBy: { id: "asc" } },
        responses: true
      }
    });

    // Populate memory cache instantly
    const initialOptions = (newPoll.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
      votes: 0,
      percentage: 0
    }));

    const cached = {
      id: newPoll.id,
      roomId: newPoll.roomId,
      roomCode: roomId,
      question: newPoll.question,
      type: newPoll.type,
      isActive: true,
      totalVotes: 0,
      options: initialOptions,
      wordCloud: [],
      wordMap: {},
      voters: new Set(),
      createdAt: newPoll.createdAt
    };

    activePollCache.set(newPoll.id, cached);
    roomToActivePollId.set(roomId, newPoll.id);

    const formatted = buildPublicPoll(cached);
    io.to(roomId).emit("poll_created", formatted);

    res.status(201).json({ message: "Template launched successfully to audience", poll: formatted });
  } catch (err) {
    console.error("Launch template poll error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Host reveals the correct answer for a Live Quiz
app.post("/api/rooms/:roomId/polls/:pollId/reveal", verifyToken, async (req, res) => {
  const { roomId, pollId } = req.params;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    if (!access) return res.status(404).json({ message: "Room not found or unauthorized" });

    const poll = await prisma.poll.update({
      where: { id: pollId },
      data: { isQuizRevealed: true },
      include: { options: true }
    });

    const correctOption = poll.options.find(o => o.isCorrect);

    if (activePollCache.has(pollId)) {
      const cached = activePollCache.get(pollId);
      cached.isQuizRevealed = true;
      cached.options = cached.options.map(opt => ({
        ...opt,
        isCorrect: poll.options.find(o => o.id === opt.id)?.isCorrect || false
      }));
    }

    const canonicalRoomCode = access.room.roomCode;
    io.to(canonicalRoomCode).emit("quiz_revealed", {
      pollId,
      correctOptionId: correctOption?.id || null,
      correctOptionText: correctOption?.text || null
    });
    if (access.room.customSlug && access.room.customSlug !== canonicalRoomCode) {
      io.to(access.room.customSlug).emit("quiz_revealed", {
        pollId,
        correctOptionId: correctOption?.id || null,
        correctOptionText: correctOption?.text || null
      });
    }

    res.json({ message: "Quiz answer revealed successfully", poll });
  } catch (err) {
    console.error("Quiz reveal error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Stage / Projector View Data Endpoint
app.get("/api/rooms/stage/:roomId", async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ roomCode: roomId }, { customSlug: roomId }]
      },
      include: {
        host: { select: { plan: true, username: true } },
        messages: {
          where: { status: "accepted" },
          orderBy: [{ isPinned: "desc" }, { upvotes: "desc" }, { createdAt: "desc" }],
          take: 60
        }
      }
    });

    if (!room) {
      return res.status(404).json({ message: "Stage room not found" });
    }

    const activeTier = room.isPassUsed ? "ROOM_PASS" : (room.host.plan || "SOLO");
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;
    const activePoll = await getOrHydrateActivePoll(room.roomCode, null);

    res.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        customSlug: room.customSlug,
        title: room.title,
        startsAt: room.startsAt,
        expiresAt: room.expiresAt,
        isAccepting: room.isAccepting,
        activityType: room.activityType,
        brandLogo: room.brandLogo,
        brandColor: room.brandColor,
        stageTheme: room.stageTheme || "dark",
        showWatermark: limits.stageWatermark, // true for SOLO, false for paid/passes
        tier: activeTier,
      },
      stageWatermark: limits.stageWatermark,
      stageTheme: room.stageTheme || "dark",
      brandLogo: room.brandLogo,
      brandColor: room.brandColor,
      messages: room.messages.map(buildPublicMessage),
      activePoll: buildPublicPoll(activePoll)
    });
  } catch (err) {
    console.error("Stage room fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Studio Plan: Update Room Branding (Logo, Custom Colors & Stage Theme)
app.post("/api/rooms/:roomId/branding", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { brandColor, stageTheme, brandLogo, brandLogoBase64, brandLogoMime } = req.body;
  const rawLogo = brandLogo || brandLogoBase64;

  try {
    const access = await findRoomAccess(roomId, req.user.id);
    if (!access) return res.status(404).json({ message: "Room not found or unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const activeTier = access.room.isPassUsed ? "ROOM_PASS" : (user?.plan || "SOLO");
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    if (!limits.canCustomBranding) {
      return res.status(403).json({
        message: "Custom branding and logo uploads are exclusive to the Studio plan. Upgrade to unlock white-labeling."
      });
    }

    let validBrandLogo = undefined;

    if (rawLogo) {
      const mimeMatch = rawLogo.match(/^data:(image\/[a-z0-9+.-]+);base64,/i);
      const mime = brandLogoMime || (mimeMatch ? mimeMatch[1] : "image/png");
      const cleanBase64 = rawLogo.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      // 1. Validate file size and magic byte signatures
      const validation = validateImageBuffer(buffer, mime);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }

      // 2. Server-side NSFW / Inappropriate content check
      const safety = await checkImageSafety(cleanBase64, mime);
      if (!safety.safe) {
        return res.status(400).json({ message: safety.error });
      }

      validBrandLogo = `data:${mime};base64,${cleanBase64}`;
    } else if (brandLogo === null || brandLogo === "") {
      validBrandLogo = null;
    }

    const updated = await prisma.room.update({
      where: { id: access.room.id },
      data: {
        ...(validBrandLogo !== undefined && { brandLogo: validBrandLogo }),
        ...(brandColor && { brandColor }),
        ...(stageTheme && { stageTheme }),
      }
    });

    const canonicalRoomCode = access.room.roomCode;
    io.to(canonicalRoomCode).emit("branding_updated", {
      brandLogo: updated.brandLogo,
      brandColor: updated.brandColor,
      stageTheme: updated.stageTheme,
    });
    if (access.room.customSlug && access.room.customSlug !== canonicalRoomCode) {
      io.to(access.room.customSlug).emit("branding_updated", {
        brandLogo: updated.brandLogo,
        brandColor: updated.brandColor,
        stageTheme: updated.stageTheme,
      });
    }

    res.json({ message: "Room branding updated successfully", room: updated });
  } catch (err) {
    console.error("Branding update error:", err);
    res.status(500).json({ message: "Failed to update branding: " + err.message });
  }
});

// Studio Plan: AI Semantic Question Clustering
app.get("/api/rooms/:roomId/ai/cluster", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    if (!access) return res.status(404).json({ message: "Room not found or unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const activeTier = access.room.isPassUsed ? "ROOM_PASS" : (user?.plan || "SOLO");
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    if (!limits.canAiClustering) {
      return res.status(403).json({
        message: "AI Semantic Question Clustering is exclusive to the Studio plan. Upgrade to cluster audience questions."
      });
    }

    const messages = await prisma.message.findMany({
      where: { roomId: access.room.id, status: "accepted" },
      select: { id: true, content: true }
    });

    const rawClusters = await clusterQuestions(messages);
    const idToContent = new Map(messages.map((m) => [m.id, m.content]));
    const clusters = (rawClusters || []).map((c) => ({
      topic: c.topic || "General Discussion",
      questionIds: c.questionIds || [],
      questions: (c.questionIds || []).map((id) => idToContent.get(id) || id),
      summary: c.summary || ""
    }));

    res.json({ clusters });
  } catch (err) {
    console.error("AI cluster error:", err);
    res.status(500).json({ message: "AI clustering failed: " + err.message });
  }
});

// Studio Plan: AI Session Executive Summary & Sentiment Analysis
app.get("/api/rooms/:roomId/ai/summary", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  try {
    const access = await findRoomAccess(roomId, req.user.id);
    if (!access) return res.status(404).json({ message: "Room not found or unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const activeTier = access.room.isPassUsed ? "ROOM_PASS" : (user?.plan || "SOLO");
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    if (!limits.canAiSummary) {
      return res.status(403).json({
        message: "AI Executive Summaries & Sentiment Analysis are exclusive to the Studio plan. Upgrade to generate reports."
      });
    }

    const room = await prisma.room.findUnique({
      where: { id: access.room.id },
      include: {
        messages: { where: { status: "accepted" } },
        polls: { include: { options: true, responses: true } }
      }
    });

    const summaryData = await generateSessionSummary(room.messages, room.polls, room.title);
    res.json({ summary: summaryData });
  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ message: "AI summary generation failed: " + err.message });
  }
});

// Export Session Data (TXT, CSV, JSON/PDF Data)
app.get("/api/rooms/:roomId/export", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { format = "txt" } = req.query;
  const requestedFormat = String(format).toLowerCase();

  try {
    const access = await findRoomAccess(roomId, req.user.id);
    if (!access) return res.status(404).json({ message: "Room not found or unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const activeTier = access.room.isPassUsed ? "ROOM_PASS" : (user?.plan || "SOLO");
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    // Check tier export permission
    if (!limits.exportFormats.includes(requestedFormat)) {
      const neededTier = requestedFormat === "csv" 
        ? "a 24h Room Pass, Host, or Studio plan" 
        : requestedFormat === "json" 
        ? "the Host or Studio plan" 
        : "the Studio plan";
      return res.status(403).json({
        message: `Exporting in .${requestedFormat.toUpperCase()} format requires ${neededTier}.`
      });
    }

    const room = await prisma.room.findUnique({
      where: { id: access.room.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        polls: {
          include: {
            options: { orderBy: { id: "asc" } },
            responses: true
          }
        }
      }
    });

    // 1. PDF Executive Report (Studio Exclusive)
    if (requestedFormat === "pdf") {
      return generateSessionPdfReport(res, room);
    }

    // 2. CSV Spreadsheet Export (Anonymous: No IDs, Device, or Location)
    if (requestedFormat === "csv") {
      let csv = "Number,Question / Message,Status,Upvotes,Is Answered,Is Pinned,Host Reply,Submitted At\n";
      room.messages.forEach((m, idx) => {
        const cleanContent = `"${(m.content || '').replace(/"/g, '""')}"`;
        const cleanReply = `"${(m.hostReply || '').replace(/"/g, '""')}"`;
        csv += `${idx + 1},${cleanContent},${m.status},${m.upvotes},${m.isAnswered},${m.isPinned},${cleanReply},${m.createdAt.toISOString()}\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="whisprlive-${room.roomCode}-transcript.csv"`);
      return res.send(csv);
    }

    // 3. Full JSON Data Export (Anonymous: No DB IDs, Device, Location, or User hashes)
    if (requestedFormat === "json") {
      return res.json({
        roomCode: room.roomCode,
        customSlug: room.customSlug,
        title: room.title,
        createdAt: room.createdAt,
        totalQuestions: room.messages.length,
        answeredQuestions: room.messages.filter(m => m.isAnswered).length,
        totalUpvotes: room.messages.reduce((sum, m) => sum + (m.upvotes || 0), 0),
        messages: room.messages.map((m, idx) => ({
          number: idx + 1,
          content: m.content,
          status: m.status,
          upvotes: m.upvotes,
          isAnswered: m.isAnswered,
          isPinned: m.isPinned,
          hostReply: m.hostReply,
          submittedAt: m.createdAt
        })),
        polls: room.polls.map(p => ({
          question: p.question,
          type: p.type,
          isQuiz: p.isQuiz,
          options: p.options ? p.options.map(opt => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            votes: p.responses ? p.responses.filter(r => r.optionId === opt.id).length : 0
          })) : [],
          totalResponses: p.responses ? p.responses.length : 0
        }))
      });
    }

    // 4. Default Plain Text (.txt) Export (Anonymous)
    let txt = `=================================================\n`;
    txt += `WHISPRLIVE LIVE SESSION REPORT & TRANSCRIPT\n`;
    txt += `Title: ${room.title}\n`;
    txt += `Room Code: ${room.roomCode}\n`;
    if (room.customSlug) txt += `Custom URL: whisprlive.live/ask/${room.customSlug}\n`;
    txt += `Date: ${new Date(room.createdAt).toLocaleString()}\n`;
    txt += `Total Questions: ${room.messages.length}\n`;
    txt += `=================================================\n\n`;

    txt += `--- AUDIENCE QUESTIONS & HOST REPLIES ---\n\n`;
    room.messages.forEach((m, idx) => {
      txt += `[#${idx + 1}] (${m.upvotes} upvotes) ${m.isAnswered ? "[ANSWERED] " : ""}${m.isPinned ? "[PINNED] " : ""}\n`;
      txt += `Question: ${m.content}\n`;
      if (m.hostReply) txt += `Host Reply: ${m.hostReply}\n`;
      txt += `Submitted: ${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\n`;
    });

    if (room.polls && room.polls.length > 0) {
      txt += `--- LIVE POLLS, QUIZZES & WORD CLOUDS ---\n\n`;
      room.polls.forEach((p, pIdx) => {
        txt += `Poll #${pIdx + 1}: ${p.question} (${p.type}${p.isQuiz ? " - QUIZ" : ""})\n`;
        if (p.type === "CHOICE" && p.options) {
          p.options.forEach(opt => {
            const votes = p.responses ? p.responses.filter(r => r.optionId === opt.id).length : 0;
            txt += `  - ${opt.text}: ${votes} votes ${opt.isCorrect ? "✓ (Correct Answer)" : ""}\n`;
          });
        }
        txt += `\n`;
      });
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="whisprlive-${room.roomCode}-transcript.txt"`);
    return res.send(txt);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: "Failed to export session data" });
  }
});

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
})