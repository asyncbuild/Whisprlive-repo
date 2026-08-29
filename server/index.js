import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import {nanoid} from "nanoid"
import { verifyToken } from "./middleware/middleware.js"

// Dynamically import prisma after env vars are loaded
const prisma = await import("./config/db.js").then(m => m.default)

const app = express()

app.use(cors())
app.use(express.json())

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

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})