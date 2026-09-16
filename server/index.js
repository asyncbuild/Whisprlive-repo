import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { nanoid } from "nanoid"
import { verifyToken } from "./middleware/middleware.js"
import { authLimiter, roomCreationLimiter, messageSubmissionLimiter, paymentLimiter, feedbackLimiter } from "./middleware/rateLimiter.js"
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

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// In-Memory OTP Store for email verification: email -> { code, username, hashedPassword, expiresAt, attempts }
const signupOtpStore = new Map();

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
app.use(express.json())

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
  }
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

    // Generate random 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
            <div style="background-color: #F8FAFC; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-height: 100%;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06);">
                
                <!-- Top Brand Header -->
                <div style="padding: 32px 32px 24px; text-align: center; background: #FFFFFF; border-bottom: 1px solid #F1F5F9;">
                  <div style="display: inline-block; margin-bottom: 6px;">
                    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: #0F172A;">Whispr<span style="color: #2563EB;">Live</span></span>
                  </div>
                  <p style="margin: 0; font-size: 13px; color: #64748B; font-weight: 500;">Live Q&A, Polls & Audience Engagement</p>
                </div>

                <!-- Main Content -->
                <div style="padding: 32px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0F172A; letter-spacing: -0.02em;">
                    Verify your email address
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                    Hi <strong>${cleanUsername}</strong>, welcome to WhisprLive! Please use the 6-digit verification code below to verify your email and finish setting up your account:
                  </p>

                  <!-- OTP Code Box -->
                  <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 0 0 24px 0;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 10px;">
                      Verification Code
                    </div>
                    <div style="font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #2563EB; margin-left: 12px;">
                      ${otp}
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color: #94A3B8; font-weight: 500;">
                      Expires in <strong>10 minutes</strong>
                    </div>
                  </div>

                  <!-- Security Callout -->
                  <div style="background: #EFF6FF; border-left: 3px solid #2563EB; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #1E40AF; line-height: 1.5;">
                      <strong>Security tip:</strong> Never share this code with anyone. WhisprLive will never ask for your verification code.
                    </p>
                  </div>

                  <p style="margin: 0; font-size: 12.5px; color: #94A3B8; line-height: 1.5;">
                    If you did not request this verification code or didn't attempt to sign up for WhisprLive, you can safely disregard this email.
                  </p>
                </div>

                <!-- Footer -->
                <div style="padding: 20px 32px; background: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                    © WhisprLive · Real-time interactive audience engagement
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

    const secret = process.env.JWT_SECRET || "Deepesh@#$123";
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Account verified successfully!",
      token,
      user
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
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists, Please Signin" })
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true
      }
    })
    res.status(201).json({ message: "User created successfully", user: newUser })
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
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
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

    const secret = process.env.JWT_SECRET || "Deepesh@#$123";
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: "3h" }
    );
    res.json({
      message: "Signin successful",
      token,
      user: { id: user.id, email: user.email, username: user.username, plan: user.plan || "SOLO", roomPasses: user.roomPasses || 0 }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

//Google Signin/signup route
app.post("/api/auth/google", authLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({
      message: "Google credential is required"
    })
  }
  try {
    //verify google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    })
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;
    if (!email) {
      return res.status(400).json({
        message: "Google signin failed : Email is required"
      })
    }
    // check if user already exists
    let user = await prisma.user.findUnique({
      where: { email }
    })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          username: name || email.split("@")[0],
          passwordHash: `GOOGLE_AUTH_${googleId}`,
          plan: "SOLO"
        },
        select: { id: true, email: true, username: true, plan: true },
      })
    }
    //generate app jwt token
    const secret = process.env.JWT_SECRET || "Deepesh@#$123";
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: "3h" }
    )
    res.json({
      message: "Google Sign-in Successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        plan: user.plan || 'SOLO',
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, username: true, plan: true, roomPasses: true },
    });
    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Razorpay Payment Routes
// 1. Create Razorpay Order
app.post("/api/payments/razorpay/create-order", verifyToken, paymentLimiter, async (req, res) => {
  const { planType, currency } = req.body;
  if (planType !== "ROOM_PASS") {
    return res.status(400).json({ message: "Invalid plan type" });
  }

  const isUSD = currency === "USD";
  const amount = isUSD ? 500 : 39900; // $5 USD (500 cents) or ₹399 INR (39900 paise)
  const orderCurrency = isUSD ? "USD" : "INR";

  try {
    const options = {
      amount,
      currency: orderCurrency,
      receipt: `rcpt_${req.user.id.slice(-6)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: req.user.id,
        planType: "ROOM_PASS",
      },
    };

    const order = await razorpay.orders.create(options);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ message: "Failed to initialize payment" });
  }
});

// 2. Verify Payment Signature and Credit Room Pass
app.post("/api/payments/razorpay/verify", verifyToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing payment parameters" });
  }

  try {
    // Generate expected HMAC SHA256 signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid transaction signature" });
    }

    // Grant 1 Room Pass credit to user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { roomPasses: { increment: 1 } },
      select: { id: true, email: true, username: true, plan: true, roomPasses: true },
    });

    res.json({
      message: "Payment verified successfully!",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Razorpay verification error:", err);
    res.status(500).json({ message: "Internal verification error" });
  }
});

// Room & Session Routes
// Create new session Route
app.post("/api/rooms", verifyToken, roomCreationLimiter, async (req, res) => {
  const { title, durationMinutes, startsAt, usePass, showPublicFeed, activityType } = req.body;
  const parsedDuration = parseInt(durationMinutes, 10);

  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return res.status(400).json({ error: "Invalid duration" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, roomPasses: true },
    });

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

    // Automatically apply Room Pass when a host explicitly requests one or exceeds free duration.
    let isUsingPass = false;
    if (user.roomPasses > 0) {
      if (usePass || (userPlan === "SOLO" && parsedDuration > 15)) {
        isUsingPass = true;
      }
    }

    const activeTier = isUsingPass ? "ROOM_PASS" : userPlan;
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    // Scheduled start validation for Solo tier
    const isScheduled = startsAt && (new Date(startsAt).getTime() - Date.now() > 60000);
    if (isScheduled && !limits.canSchedule) {
      return res.status(403).json({
        error: "Scheduled starts are not supported on the Solo plan. Purchase a Room Pass to schedule sessions in advance.",
      });
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
      shareableUrl: `/ask/${newRoom.roomCode}`,
      isPassUsed: isUsingPass,
      showPublicFeed: newRoom.showPublicFeed,
      activityType: newRoom.activityType,
    });
  } catch (err) {
    console.error("❌ Prisma Room Creation Error:", err);
    res.status(500).json({ error: err.message, stack: err });
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
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: {
        isAccepting: false,
        expiresAt: new Date()
      }
    })
    io.to(roomId).emit("session_ended", { roomCode: roomId })
    res.json({ message: "Session ended successfully", room: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all sessions Route (filtered by plan history retention days)
app.get("/api/rooms/history", verifyToken, async (req, res) => {
  const userId = req.user.id
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    });
    const userPlan = user?.plan || "SOLO";

    const rooms = await prisma.room.findMany({
      where: { hostId: userId },
      include: {
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
    res.status(500).json({ error: err.message });
  }
});

// Join Plan Waitlist (for Host & Studio coming soon plans)
app.post("/api/waitlist", async (req, res) => {
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, roomPasses: true }
    })
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    const limits = PLAN_LIMITS[user?.plan || "SOLO"]
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
    res.json({ messages: room.messages })
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
    await prisma.room.delete({
      where: { id: room.id }
    })
    res.json({ message: "Room deleted successfully" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Export messages as a plain text file
app.get("/api/rooms/:roomId/export", verifyToken, async (req, res) => {
  const { roomId } = req.params
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, roomPasses: true }
    })
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    const limits = PLAN_LIMITS[user?.plan || "SOLO"]
    const roomLimits = room.isPassUsed ? PLAN_LIMITS.ROOM_PASS : limits;
    const retentionMs = (roomLimits.historyRetentionDays || 7) * 24 * 60 * 60 * 1000;
    const isBeyondRetention = Date.now() - new Date(room.createdAt).getTime() > retentionMs;
    // An unused pass must not unlock unrelated historical sessions.
    const hasRoomEntitlement = room.isPassUsed;

    if (isBeyondRetention || (!limits.canExport && !hasRoomEntitlement)) {
      return res.status(403).json({
        error: "Exporting responses is a premium feature. Upgrade to Host plan or use a Room Pass."
      });
    }
    const exportText = room.messages.map((m, idx) => `[${idx + 1}] (${new Date(m.createdAt).toLocaleString()}): ${m.content}`)
      .join('\n\n');
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${room.title || 'session'}-messages.txt"`);
    res.send(exportText || 'No messages received.');
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

//public routes
//check room status
app.get("/api/rooms/public/:roomId", async (req, res) => {
  const { roomId } = req.params
  if (roomId.toLowerCase() === "demo") {
    return res.json({
      title: "Interactive WhisprLive Demo Room",
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
      where: { roomCode: roomId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        expiresAt: true,
        isAccepting: true,
        showPublicFeed: true,
        activityType: true,
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
      title: room.title,
      startsAt: room.startsAt,
      expiresAt: room.expiresAt,
      isAccepting: room.isAccepting,
      showPublicFeed: room.showPublicFeed,
      activityType: room.activityType || "ALL",
      status: isNotStarted ? 'Scheduled' : isExpired ? 'Expired' : 'Active',
      canSend
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

//Send message to a specific room 
app.post("/api/rooms/public/:roomId/messages", messageSubmissionLimiter, async (req, res) => {
  const { roomId } = req.params
  const { content } = req.body
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
    const room = await prisma.room.findUnique({
      where: { roomCode: roomId },
      include: {
        host: { select: { plan: true } },
        _count: { select: { messages: true } }
      }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }
    // Check plan message limit
    const activeTier = room.isPassUsed ? 'ROOM_PASS' : (room.host.plan || 'SOLO');
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;
    const maxMessagesAllowed = limits.maxMessages;
    const tierName = activeTier === "SOLO" ? "free tier" : activeTier;

    if (room._count.messages >= maxMessagesAllowed) {
      // Automatically end session in database
      await prisma.room.update({
        where: { id: room.id },
        data: { isAccepting: false, expiresAt: new Date() }
      });
      io.to(roomId).emit("session_ended", {
        roomCode: roomId,
        reason: `This room has reached its ${tierName} limit of ${maxMessagesAllowed} messages and has automatically ended.`
      });
      return res.status(403).json({
        message: `This room has reached its ${tierName} limit of ${maxMessagesAllowed} messages and has automatically ended.`,
        isExpired: true
      });
    }

    const now = new Date()
    if (now < new Date(room.startsAt)) {
      return res.status(400).json({ message: "Session has not started yet" })
    }
    if (now > new Date(room.expiresAt)) {
      return res.status(400).json({ message: "Session has expired" })
    }
    if (!room.isAccepting) {
      return res.status(400).json({ message: "Session is not accepting messages" })
    }

    const metadata = parseClientMetadata(req);
    const clientDeviceModel = req.body.clientDeviceModel && req.body.clientDeviceModel.toUpperCase() !== "K"
      ? req.body.clientDeviceModel.trim()
      : null;
    const finalDeviceModel = clientDeviceModel || metadata.deviceModel;

    const newMessage = await prisma.message.create({
      data: {
        roomId: room.id,
        content: content.trim(),
        status: "accepted",
        device: metadata.device,
        deviceModel: finalDeviceModel,
        location: metadata.location,
        ipAddress: metadata.ipAddress,
      }
    })
    console.log(`📨 Emitting new_message to room ${roomId}:`, newMessage);
    io.to(roomId).emit("new_message", newMessage)

    // Automatically end session if this message hits the max capacity limit
    if (room._count.messages + 1 >= maxMessagesAllowed) {
      await prisma.room.update({
        where: { id: room.id },
        data: { isAccepting: false, expiresAt: new Date() }
      });
      console.log(`Room ${roomId} reached ${tierName} capacity (${maxMessagesAllowed} messages). Session automatically ended.`);
      io.to(roomId).emit("session_ended", {
        roomCode: roomId,
        reason: `This room has reached its ${tierName} limit of ${maxMessagesAllowed} messages and has automatically ended.`
      });
    }

    res.status(201).json({
      message: "Message sent successfully",
      newMessage,
      data: {
        id: newMessage.id,
        createdAt: newMessage.createdAt
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Quick browser tester for host
// app.get('/test', (req, res) => {
//   res.send(`
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <title>Host Live Feed Test</title>
//   <script src="/socket.io/socket.io.js"></script>
//   <style>
//     body { font-family: sans-serif; padding: 24px; max-width: 600px; margin: auto; }
//     #feed { border: 1px solid #ddd; border-radius: 8px; padding: 12px; min-height: 180px; margin-top: 16px; background: #fafafa; }
//     .msg-card { background: white; border: 1px solid #4CAF50; padding: 10px; margin-bottom: 8px; border-radius: 6px; }
//     .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
//     .connected { background: #e8f5e9; color: #2e7d32; }
//     .disconnected { background: #ffebee; color: #c62828; }
//   </style>
// </head>
// <body>
//   <h2>Host Live Room Listener</h2>
//   <p>Status: <span id="status" class="badge disconnected">Disconnected</span></p>

//   <label>Host JWT Token:</label><br>
//   <input type="text" id="tokenInput" placeholder="Paste your JWT token here" style="width: 100%; padding: 6px; margin: 4px 0 12px;" /><br>

//   <label>Enter Room Code:</label><br>
//   <input type="text" id="roomInput" placeholder="e.g. REbZiBcW" style="padding: 6px;" />
//   <button onclick="connectAndJoin()" style="padding: 6px 12px; cursor: pointer;">Connect & Join</button>

//   <h3>Live Feed:</h3>
//   <div id="feed">
//     <p style="color: #999;" id="placeholder">No messages received yet...</p>
//   </div>

//   <script>
//     let socket = null;

//     function connectAndJoin() {
//       const token = document.getElementById('tokenInput').value.trim();
//       const roomCode = document.getElementById('roomInput').value.trim();

//       if (!token || !roomCode) return alert('Both Token and Room Code are required!');

//       socket = io({ auth: { token } });

//       socket.on('connect', () => {
//         document.getElementById('status').className = 'badge connected';
//         document.getElementById('status').innerText = 'Authenticated & Connected';
//         socket.emit('join_room', roomCode);
//       });

//       socket.on('connect_error', (err) => {
//         document.getElementById('status').className = 'badge disconnected';
//         document.getElementById('status').innerText = 'Auth Error: ' + err.message;
//       });

//       socket.on('joined_success', (res) => {
//         alert(res.message);
//       });

//       socket.on('error_msg', (msg) => {
//         alert(msg);
//       });

//       socket.on('new_message', (message) => {
//         const placeholder = document.getElementById('placeholder');
//         if (placeholder) placeholder.remove();

//         const feed = document.getElementById('feed');
//         const card = document.createElement('div');
//         card.className = 'msg-card';
//         card.innerHTML = '<strong>Anonymous:</strong> ' + message.content + '<br><small style="color:#666;">Time: ' + new Date(message.createdAt).toLocaleTimeString() + '</small>';
//         feed.prepend(card);
//       });
//     }
//   </script>
// </body>
// </html>
//   `);
// });

//upvote / toggle vote messages
app.patch("/api/rooms/:roomId/messages/:messageId/upvote", async (req, res) => {
  const { roomId, messageId } = req.params
  const { action } = req.body || {}
  const isDecrement = action === "downvote" || action === "unvote"
  try {
    const current = await prisma.message.findUnique({ where: { id: messageId } })
    if (!current) return res.status(404).json({ message: "Message not found" })

    const newUpvotes = isDecrement ? Math.max(0, current.upvotes - 1) : current.upvotes + 1

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { upvotes: newUpvotes }
    })
    io.to(roomId).emit("message_upvoted", {
      messageId: updatedMessage.id,
      upvotes: updatedMessage.upvotes
    })
    res.json({ message: "Vote updated successfully", upvotes: updatedMessage.upvotes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Toggle message answered status
app.patch("/api/rooms/:roomId/messages/:messageId/answered", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params
  const { isAnswered } = req.body || {}
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" })
    }
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { isAnswered: Boolean(isAnswered) }
    })
    io.to(roomId).emit("message_answered", {
      messageId: updatedMessage.id,
      isAnswered: updatedMessage.isAnswered
    })
    res.json({ message: "Answered status updated successfully", messageItem: updatedMessage })
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

// Public: Fetch approved questions for audience feed (if enabled by host)
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

// Host adds / updates an official direct answer / reply to a question
app.patch("/api/rooms/:roomId/messages/:messageId/reply", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params;
  const { hostReply } = req.body;
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    const cleanReply = typeof hostReply === "string" ? hostReply.trim() : null;
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        hostReply: cleanReply || null,
        isAnswered: Boolean(cleanReply) ? true : undefined
      }
    });

    io.to(roomId).emit("message_replied", {
      messageId: updatedMessage.id,
      hostReply: updatedMessage.hostReply,
      isAnswered: updatedMessage.isAnswered
    });

    res.json({ message: "Host reply saved successfully", messageItem: updatedMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Host toggles pinning a question to the top
app.patch("/api/rooms/:roomId/messages/:messageId/pin", verifyToken, async (req, res) => {
  const { roomId, messageId } = req.params;
  const { isPinned } = req.body;
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { isPinned: Boolean(isPinned) }
    });

    io.to(roomId).emit("message_pinned", {
      messageId: updatedMessage.id,
      isPinned: updatedMessage.isPinned
    });

    res.json({ message: "Pin status updated successfully", messageItem: updatedMessage });
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
    : { room: { roomCode: roomIdOrCode }, isActive: true };

  const poll = await prisma.poll.findFirst({
    where: whereClause,
    include: {
      room: { select: { roomCode: true, id: true } },
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
        percentage
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
  }

  return cached;
}

// Helper to format active poll with live aggregates (percentages / word clouds)
async function formatActivePoll(pollId) {
  const cached = await getOrHydrateActivePoll(null, pollId);
  return buildPublicPoll(cached);
}

// Host creates a new Live Poll / Word Cloud prompt
app.post("/api/rooms/:roomId/polls", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { question, type, options } = req.body;

  if (!question || question.trim() === "") {
    return res.status(400).json({ message: "Poll question/prompt is required" });
  }
  const pollType = type === "WORD_CLOUD" ? "WORD_CLOUD" : "CHOICE";

  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    // Deactivate previous active poll in memory cache
    const prevPollId = roomToActivePollId.get(roomId);
    if (prevPollId && activePollCache.has(prevPollId)) {
      activePollCache.get(prevPollId).isActive = false;
      activePollCache.delete(prevPollId);
    }
    roomToActivePollId.delete(roomId);

    // Automatically deactivate previous active polls in this room in DB
    await prisma.poll.updateMany({
      where: { roomId: room.id, isActive: true },
      data: { isActive: false }
    });

    const newPoll = await prisma.poll.create({
      data: {
        roomId: room.id,
        question: question.trim(),
        type: pollType,
        isActive: true,
        options: pollType === "CHOICE" && Array.isArray(options) ? {
          create: options.filter((o) => typeof o === "string" && o.trim() !== "").map((o) => ({
            text: o.trim(),
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
app.post("/api/rooms/public/:roomId/poll/:pollId/vote", async (req, res) => {
  const { roomId, pollId } = req.params;
  const { optionId, word, voterId } = req.body;

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
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

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

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
})