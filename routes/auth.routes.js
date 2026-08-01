import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendOtp, verifyOtp, login, logout, me } from "../controllers/auth.controller.js";
import {
  sendOtpValidation,
  verifyOtpValidation,
  loginValidation,
  validate,
} from "../middleware/validation.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = Router();

// Extra-strict limiter on top of the global one — OTP endpoints are the
// most attractive target for abuse (spam, brute force).
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

router.post("/send-otp", otpLimiter, sendOtpValidation, validate, sendOtp);
router.post("/verify-otp", otpLimiter, verifyOtpValidation, validate, verifyOtp);
router.post("/login", loginLimiter, loginValidation, validate, login);
router.post("/logout", logout);
router.get("/me", authenticateJWT, me);

export default router;
