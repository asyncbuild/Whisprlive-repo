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

// 2. Room Creation Rate Limiter
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

// 3. Message / Question Submission Rate Limiter
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

// 4. Payment Creation Rate Limiter
// Prevents automated spam of Razorpay order creation
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Limit each IP to 10 payment checkout creations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Payment checkout limit reached. Please try again in 15 minutes."
  }
});

// 5. Feedback Submission Rate Limiter
// Prevents automated spam of user suggestions and feedback submissions
export const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 5, // Limit each IP to 5 feedback submissions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Feedback submission limit reached. Please wait a while before submitting another suggestion."
  }
});

