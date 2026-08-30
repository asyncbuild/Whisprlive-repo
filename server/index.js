import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import {nanoid} from "nanoid"
import { verifyToken } from "./middleware/middleware.js"
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeSockets } from './sockets/socketHandler.js';
import prisma from "./config/db.js"
import {PLAN_LIMITS} from "./config/plans.js"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express()
const httpServer = createServer(app)

const STRIPE_PRICES = {
  HOST:{
    amount:1800,
    name:"WhisprLive Host Plan",
    description:"Unlimited sessions, 1,000 guests, 60-min timers, and exports"
  },
  STUDIO: {
    amount: 4900,
    name: "WhisprLive Studio Plan",
    description: "Everything in Host + 5 seats and 120-min timers",
  },
}

app.post("/api/payments/webhook",express.raw({type:"application/json"}),async(req,res)=>{
    const sig = req.headers["stripe-signature"]
    let event
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      console.error(`⚠️ Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if(event.type === 'checkout.session.completed'){
      const session  = event.data.object;
      const userId   = session.metadata?.userId;
      const planType = session.metadata?.planType;
      if(userId && planType){
        try {
          await prisma.user.update({
            where:{id:userId},
            data:{plan: planType}
          })
          console.log(`Plan upgraded successfully: ${planType} for user ${userId}`)
        } catch (error) {
          console.error("❌ Error updating user plan:", error)
          return res.status(500).json({error:error.message,stack:error})
        }
      }
    }
    res.json({received:true})
})

app.use(cors())
app.use(express.json())

const io = new Server(httpServer,{
  cors:{
    origin:"*",
    methods:["GET","POST"]
  }
})

initializeSockets(io, prisma) // Pass prisma to socket initialization

//Authentication Routes

// Signup Route
app.post("/signup",async(req,res)=>{
  const {username,email,password} = req.body
  if(!username || !email || !password){
    return res.status(400).json({message:"All fields are required"})
  }
  try{
    const existingUser = await prisma.user.findUnique({where:{email}})
    if(existingUser){
      return res.status(400).json({message:"User already exists, Please Signin"})
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt)
    const newUser = await prisma.user.create({
      data:{
        username,
        email,
        passwordHash:hashedPassword
      },
      select:{
        id:true,
        email:true,
        username:true,
        createdAt:true
      }
    })
    res.status(201).json({message:"User created successfully",user:newUser})
  }catch(err){
    console.error(err)
    res.status(500).json({message:"Internal Server Error"})
  } 
})

// Signin Route
app.post("/signin",async(req,res)=>{
  const {email,password} = req.body
  if(!email || !password){
    return res.status(400).json({message:"All fields are required"})
  }

  try{
    const user = await prisma.user.findUnique({where:{email}})
    if(!user){
      return res.status(400).json({message:"User does not exist, Please Signup"})
    }
    const isMatch = await bcrypt.compare(password,user.passwordHash)
    if(!isMatch){
      return res.status(400).json({message:"Invalid email or password"})
    }

    const token = jwt.sign(
      {id:user.id,email:user.email,username:user.username},
      process.env.JWT_SECRET,
      {expiresIn:"3h"}
    );
    res.json({
      message:"Signin successful",
      token,
      user:{id:user.id,email:user.email,username:user.username}
    })
  } catch(err) {
    res.status(500).json({error:err.message})
  }
})

//Fetch current user details and plans
app.get("/api/user/me",verifyToken,async(req,res)=>{
  try{
    const user = await prisma.user.findUnique({
      where:{id:req.user.id},
      select:{id:true,email:true,username:true,plan:true}
    })
    res.json({user})
  } catch(err){
    res.status(500).json({error:err.message})
  }
})

//Stripe Checkout Route
app.post("/api/payments/create-checkout-session",verifyToken,async(req,res)=>{
  const {planType} = req.body;
  const planInfo = STRIPE_PRICES[planType];
    if(!planType || !planInfo){
      return res.status(400).json({error:"Invalid plan type"})
    }
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types:["card"],
        line_items:[
          {
            price_data:{
              currency:"usd",
              product_data:{
                name:planInfo.name,
                description:planInfo.description
              },
              unit_amount:planInfo.amount,
            },
            quantity:1
          }
        ],
        mode:"payment",
        customer_email:req.user.email,
        metadata:{
          userId: req.user.id,
          planType:planType
        },
        success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard?payment=success&plan=${planType}`,
        cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/#pricing`,
      })
      res.json({url:session.url})
    } catch (error) {
      console.error("Stripe session creation error:", err);
      res.status(500).json({error:error.message})
    }
});

// Room & Session Routes
// Create new session Route
app.post("/api/rooms",verifyToken,async(req,res)=>{
    const {title,durationMinutes,startsAt} = req.body
    const parsedDuration = parseInt(durationMinutes, 10);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({ error: 'Valid duration in minutes is required.' });
    }
    if(!title){
        return res.status(400).json(
          {message:"Title is required"}
        )
    }
    try{
      // 1. fetch user and their plan
      const user = await prisma.user.findUnique({
        where:{id:req.user.id},
        select:{plan:true}
      })
      const userPlan = user?.plan || "SOLO" // Default to SOLO if plan is missing
      const limits = PLAN_LIMITS[userPlan]
      // 2. check duration limit
      if(parsedDuration > limits.maxDurationMinutes){
        return res.status(403).json({
          error: `Your ${userPlan} plan allows sessions up to ${limits.maxDurationMinutes} minutes only. Upgrade to unlock longer sessions.`
        });
      }
      // 3. check monthly session limit
      if(limits.monthlySessions !== Infinity){
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const activeCount = await prisma.room.count({
          where: {
            hostId: req.user.id,
            createdAt: { gte: startOfMonth }
          }
        });
        
        if (activeCount >= limits.monthlySessions) {
          return res.status(403).json({
            error: `You have reached the maximum number of sessions allowed for your ${userPlan} plan this month. Upgrade to create more.`
          });
        }
      }
      // 4. Generate unique room code
    const roomCode = nanoid(8)
    const sessionStartTime = startsAt ? new Date(startsAt) : new Date()
    const expiresAt = new Date(sessionStartTime.getTime() + parsedDuration * 60000)

      const newRoom = await prisma.room.create({
        data:{
          hostId:req.user.id,
          roomCode,
          title: title || 'Ask me anything....',
          durationMinutes : parseInt(durationMinutes,10),
          startsAt:sessionStartTime,
          expiresAt
        }
      })
      res.status(201).json({
        message:"Session created Successfully",
        room:roomCode,
        shareableUrl:`/ask/${newRoom.roomCode}`
      })
    }catch(err){
      console.error("❌ Prisma Room Creation Error:", err); // <-- Check this in your terminal
      res.status(500).json({ error: err.message, stack: err });
    }
})

// End an active session (closes it in database immediately)
app.patch("/api/rooms/:roomId/end",verifyToken,async(req,res)=>{
    const {roomId} = req.params
    try{
      const room = await prisma.room.findFirst({
        where:{roomCode:roomId,hostId:req.user.id}
      })
      if(!room){
        return res.status(404).json({message:"Room not found or unauthorized"})
      }
      const updated = await prisma.room.update({
        where:{id:room.id},
        data:{
          isAccepting:false,
          expiresAt:new Date()
        }
      })
      io.to(roomId).emit("session_ended",{roomCode:roomId})
      res.json({message:"Session ended successfully",room:updated})
    } catch(err){
      res.status(500).json({error: err.message})
    }
})

// Get all sessions Route
app.get("/api/rooms/history",verifyToken,async(req,res)=>{
    const userId = req.user.id
    try{
      const rooms = await prisma.room.findMany({
        where:{hostId:userId},
        include:{
          _count:{
            select:{ messages : true}
          }
        },
        orderBy:{createdAt : 'desc'}
      })
      res.json({rooms})
    }catch(err){
      res.status(500).json({error: err.message})
    }
})

// Get all msgs for a specific room 
app.get("/api/rooms/:roomId/messages",verifyToken,async(req,res)=>{
    const {roomId} = req.params
    try{
      const room = await prisma.room.findFirst({
        where:{roomCode:roomId,hostId:req.user.id},
        include:{
          messages:{
            orderBy:{createdAt : 'desc'}
          }
        }
      })
      if(!room){
        return res.status(404).json({message:"Room not found or unauthorized"})
      }
      res.json({messages: room.messages})
    } catch(err){
      res.status(500).json({error: err.message})
    }
})

// Delete a selected post session
app.delete("/api/rooms/:roomId",verifyToken,async(req,res)=>{
    const {roomId} = req.params
    try{
      const room = await prisma.room.findFirst({
        where:{roomCode:roomId,hostId:req.user.id}
      })
      if(!room){
        return res.status(404).json({message:"Room not found or unauthorized"})
      }
      await prisma.room.delete({
        where:{id:room.id}
      })
      res.json({message:"Room deleted successfully"})
    } catch(err){
      res.status(500).json({error: err.message})
    }
})

// Export messages as a plain test file
app.get("/api/rooms/:roomId/export",verifyToken,async(req,res)=>{
    const {roomId} = req.params
    try{
      const user = await prisma.user.findUnique({
        where:{id:req.user.id},
        select:{plan:true}
      })
      const limits = PLAN_LIMITS[user?.plan || "SOLO"]
      if(!limits.canExport){
        return res.status(403).json({
          error: "Exporting responses is a premium feature. Please upgrade to the Host plan."
        });
      }
      const room = await prisma.room.findFirst({
        where:{roomCode:roomId,hostId:req.user.id},
        include:{
          messages:{
            orderBy:{createdAt : 'desc'}
          }
        }
      })
      if(!room){
        return res.status(404).json({message:"Room not found or unauthorized"})
      }
      const exportText = room.messages.map((m, idx) => `[${idx + 1}] (${new Date(m.createdAt).toLocaleString()}): ${m.content}`)
      .join('\n\n');
      res.setHeader('Content-Type','text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="${room.title || 'session'}-messages.txt"`);
      res.send(exportText || 'No messages received.');
    }catch(err){
      res.status(500).json({error: err.message})
    }

})

//public routes
//check room status
app.get("/api/rooms/public/:roomId",async(req,res)=>{
    const {roomId} = req.params
    try{
      const room = await prisma.room.findFirst({
        where:{roomCode:roomId},
        select:{
          id:true,
          title:true,
          startsAt:true,
          expiresAt:true,
          isAccepting:true,
        }
      })
      if(!room){
        return res.status(404).json({message:"Room not found"})
      }
      const now  = new Date()
      const isNotStarted = now < new Date(room.startsAt)
      const isExpired = now > new Date(room.expiresAt)
      const canSend = !isNotStarted && !isExpired && room.isAccepting
      res.json({
        title:room.title,
        startsAt:room.startsAt,
        expiresAt:room.expiresAt,
        status: isNotStarted ? 'Scheduled' : isExpired ? 'Expired' : 'Active',
        canSend
      })
    }catch(err){
      res.status(500).json({error: err.message})
    }
})

//Send message to a specific room 
app.post("/api/rooms/public/:roomId/messages",async(req,res)=>{
    const {roomId} = req.params
    const {content} = req.body
    if(!content || content.trim() === ""){
      return res.status(400).json({message:"Message is required"})
    }
    if(content.length > 300){
      return res.status(400).json({message:"Message exceeds 300 characters"})
    }
    try{
      const room = await prisma.room.findUnique({
        where:{roomCode:roomId},
        include:{
          host:{select:{plan:true}},
          _count:{select:{messages:true}}
        }
      })
      if(!room){
        return res.status(404).json({message:"Room not found"})
      }
      //check plan limit
      const limits = PLAN_LIMITS[room.host.plan || 'SOLO']
      if(room._count.messages >= limits.maxGuests){
        return res.status(403).json({message: "This session has reached its participant capacity."})
      }
      const now = new Date()
      if(now < new Date(room.startsAt)){
        return res.status(400).json({message:"Session has not started yet"})
      }
      if(now > new Date(room.expiresAt)){
        return res.status(400).json({message:"Session has expired"})
      }
      if(!room.isAccepting){
        return res.status(400).json({message:"Session is not accepting messages"})
      }
      const newMessage = await prisma.message.create({
        data:{
          roomId:room.id,
          content:content.trim(),
          status:"accepted"
        }
      })
      console.log(`📨 Emitting new_message to room ${roomId}:`, newMessage);
      io.to(roomId).emit("new_message",newMessage)
      res.status(201).json({
        message:"Message sent successfully",
        newMessage,
        data:{
          id:newMessage.id,
          createdAt:newMessage.createdAt
        }
      })
    }catch(err){
      res.status(500).json({error: err.message})
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
app.patch("/api/rooms/:roomId/messages/:messageId/upvote",async(req,res)=>{
  const {roomId,messageId} = req.params
  const {action} = req.body || {}
  const isDecrement = action === "downvote" || action === "unvote"
  try{
      const current = await prisma.message.findUnique({ where: { id: messageId } })
      if (!current) return res.status(404).json({ message: "Message not found" })

      const newUpvotes = isDecrement ? Math.max(0, current.upvotes - 1) : current.upvotes + 1

      const updatedMessage = await prisma.message.update({
        where:{id:messageId},
        data:{upvotes: newUpvotes}
      })
      io.to(roomId).emit("message_upvoted",{
        messageId:updatedMessage.id,
        upvotes:updatedMessage.upvotes
      })
      res.json({message:"Vote updated successfully",upvotes:updatedMessage.upvotes})
    }catch(err){
      res.status(500).json({error: err.message})
    }
})

httpServer.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`)
})