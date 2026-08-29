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
// Dynamically import prisma after env vars are loaded
const prisma = await import("./config/db.js").then(m => m.default)

const app = express()
const httpServer = createServer(app)

app.use(cors())
app.use(express.json())

const io = new Server(httpServer,{
  cors:{
    origin:"*",
    methods:["GET","POST"]
  }
})

initializeSockets(io) // Initialize socket handling with authentication

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
    res.status(505).json({error:err.message})
  }
})

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
    const roomCode = nanoid(8)
    const sessionStartTime = startsAt ? new Date(startsAt) : new Date()
    const expiresAt = new Date(sessionStartTime.getTime() + durationMinutes * 60000)

    try{
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
        where:{roomCode:roomId},
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
        where:{roomCode:roomId}
      })
      if(!room){
        return res.status(404).json({message:"Room not found"})
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

httpServer.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`)
})