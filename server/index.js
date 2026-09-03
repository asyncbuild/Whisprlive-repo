import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { nanoid } from "nanoid"
import { verifyToken } from "./middleware/middleware.js"
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

app.use(cors())
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
app.use(express.json())

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WhisprLive API Server is running" });
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
app.post("/signup", async (req, res) => {
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
app.post("/signin", async (req, res) => {
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
app.post("/api/auth/google", async (req, res) => {
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
app.post("/api/payments/razorpay/create-order", verifyToken, async (req, res) => {
  const { planType } = req.body;
  if (planType !== "ROOM_PASS") {
    return res.status(400).json({ message: "Invalid plan type" });
  }

  try {
    const options = {
      amount: 39900, // ₹399 in paise
      currency: "INR",
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
app.post("/api/rooms", verifyToken, async (req, res) => {
  const { title, durationMinutes, startsAt, usePass } = req.body;
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

    // Automatically apply Room Pass if requested, or if duration > 15 min, or if 3 free rooms reached
    let isUsingPass = false;
    if (user.roomPasses > 0) {
      if (usePass || (userPlan === "SOLO" && (parsedDuration > 15 || standardCount >= 3))) {
        isUsingPass = true;
      }
    }

    const activeTier = isUsingPass ? "ROOM_PASS" : userPlan;
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;

    // Monthly cap check for standard Free rooms
    if (!isUsingPass && limits.monthlySessions !== Infinity && standardCount >= limits.monthlySessions) {
      return res.status(403).json({
        error: "You have used your 3 free monthly rooms. Purchase a Room Pass to create another.",
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
      },
    });

    res.status(201).json({
      message: "Session created successfully",
      room: roomCode,
      shareableUrl: `/ask/${newRoom.roomCode}`,
      isPassUsed: isUsingPass,
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

// Get all sessions Route
app.get("/api/rooms/history", verifyToken, async (req, res) => {
  const userId = req.user.id
  try {
    const rooms = await prisma.room.findMany({
      where: { hostId: userId },
      include: {
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ rooms })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all msgs for a specific room 
app.get("/api/rooms/:roomId/messages", verifyToken, async (req, res) => {
  const { roomId } = req.params
  try {
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
      select: { plan: true }
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
    if (!limits.canExport && !room.isPassUsed) {
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
  try {
    const room = await prisma.room.findFirst({
      where: { roomCode: roomId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        expiresAt: true,
        isAccepting: true,
      }
    })
    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }
    const now = new Date()
    const isNotStarted = now < new Date(room.startsAt)
    const isExpired = now > new Date(room.expiresAt)
    const canSend = !isNotStarted && !isExpired && room.isAccepting
    res.json({
      title: room.title,
      startsAt: room.startsAt,
      expiresAt: room.expiresAt,
      status: isNotStarted ? 'Scheduled' : isExpired ? 'Expired' : 'Active',
      canSend
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

//Send message to a specific room 
app.post("/api/rooms/public/:roomId/messages", async (req, res) => {
  const { roomId } = req.params
  const { content } = req.body
  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Message is required" })
  }
  if (content.length > 300) {
    return res.status(400).json({ message: "Message exceeds 300 characters" })
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
    //check plan limit
    const activeTier = room.isPassUsed ? 'ROOM_PASS' : (room.host.plan || 'SOLO');
    const limits = PLAN_LIMITS[activeTier] || PLAN_LIMITS.SOLO;
    if (room._count.messages >= limits.maxGuests) {
      return res.status(403).json({ message: "This session has reached its participant capacity." })
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
    const newMessage = await prisma.message.create({
      data: {
        roomId: room.id,
        content: content.trim(),
        status: "accepted"
      }
    })
    console.log(`📨 Emitting new_message to room ${roomId}:`, newMessage);
    io.to(roomId).emit("new_message", newMessage)
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

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
})