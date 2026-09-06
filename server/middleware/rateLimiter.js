import rateLimit from "express-rate-limit";

// 1. Authentication Rate Limiter (Signup, Signin, Google Auth)
// Prevents brute-force password attacks and credential stuffing
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Limit each IP to 10 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts from this IP. Please try again after 15 minutes."
  }
});

// 2. General API Rate Limiter
// Protects database and server resources across all API routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP. Please slow down and try again later."
  }
});

// 3. Room Creation Rate Limiter
// Prevents spam creation of disposable Q&A rooms
export const roomCreationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes window
  max: 5, // Limit each IP to 5 room creations per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Room creation limit reached. Please wait 10 minutes before creating another room."
  }
});

// 4. Message / Question Submission Rate Limiter
// Prevents bot scripts from spamming live Q&A rooms
export const messageSubmissionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // Limit each IP to 10 questions per 1 minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "You are posting questions too fast. Please wait a moment before sending another."
  }
});
