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

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

// Signup Route
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
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(400).json({ message: "User does not exist, Please Signup" })
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" })
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
  const { title, durationMinutes, startsAt, usePass, showPublicFeed } = req.body;
  const parsedDuration = parseInt(durationMinutes, 10);

  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return res.status(400).json({ error: "Valid duration in minutes is required." });
  }
  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true, roomPasses: true },
    });

    const userPlan = user?.plan || "SOLO";
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
      },
    });

    res.status(201).json({
      message: "Session created successfully",
      room: roomCode,
      shareableUrl: `/ask/${newRoom.roomCode}`,
      isPassUsed: isUsingPass,
      showPublicFeed: newRoom.showPublicFeed,
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

// Host updates room settings (e.g. toggle audience visibility of Q&A feed)
app.patch("/api/rooms/:roomId/settings", verifyToken, async (req, res) => {
  const { roomId } = req.params;
  const { showPublicFeed } = req.body;
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId, hostId: req.user.id }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: {
        showPublicFeed: typeof showPublicFeed === "boolean" ? showPublicFeed : room.showPublicFeed
      }
    });

    io.to(roomId).emit("room_settings_updated", {
      roomCode: roomId,
      showPublicFeed: updated.showPublicFeed
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

// Helper to format active poll with live aggregates (percentages / word clouds)
async function formatActivePoll(pollId) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
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

  let wordCloud = [];
  if (poll.type === "WORD_CLOUD") {
    const wordCounts = {};
    poll.responses.forEach((r) => {
      if (r.word) {
        const clean = r.word.trim().toLowerCase();
        wordCounts[clean] = (wordCounts[clean] || 0) + 1;
      }
    });
    wordCloud = Object.entries(wordCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    id: poll.id,
    roomId: poll.roomId,
    question: poll.question,
    type: poll.type,
    isActive: poll.isActive,
    totalVotes,
    options: formattedOptions,
    wordCloud,
    createdAt: poll.createdAt
  };
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

    // Automatically deactivate previous active polls in this room
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
      }
    });

    const formatted = await formatActivePoll(newPoll.id);
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

  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId },
      select: { id: true }
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const activePoll = await prisma.poll.findFirst({
      where: { roomId: room.id, isActive: true },
      select: { id: true }
    });

    if (!activePoll) {
      return res.json({ poll: null });
    }

    const formatted = await formatActivePoll(activePoll.id);
    res.json({ poll: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public Audience: Cast a vote or submit a word
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
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { room: true }
    });

    if (!poll || !poll.isActive || poll.room.roomCode !== roomId) {
      return res.status(400).json({ message: "Poll is not active or unavailable" });
    }

    // Check if voter already participated
    const existing = await prisma.pollResponse.findUnique({
      where: {
        pollId_voterId: {
          pollId,
          voterId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: "You have already participated in this poll" });
    }

    // Record response
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

    const formatted = await formatActivePoll(pollId);
    io.to(roomId).emit("poll_updated", formatted);

    res.json({ message: "Vote recorded successfully", poll: formatted });
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

    await prisma.poll.update({
      where: { id: pollId },
      data: { isActive: false }
    });

    io.to(roomId).emit("poll_ended", { pollId });
    res.json({ message: "Poll ended successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
})