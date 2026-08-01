// =====================================================================
// Auth controller — OTP send/verify, login, logout.
// Business logic (OTP generation/storage/rate-limits) lives in
// services/otp.service.js; this file only orchestrates the request.
// =====================================================================
import { query } from "../config/database.js";
import { comparePassword } from "../utils/password.js";
import { signAccessToken } from "../services/jwt.service.js";
import { sendOtpEmail } from "../services/mail.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  isResendLimited,
  createOtp,
  verifyOtp as verifyOtpRecord,
} from "../services/otp.service.js";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches default JWT_EXPIRES_IN

function setAuthCookie(res, token) {
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

// ---------------------------------------------------------------------
// POST /api/auth/send-otp
// ---------------------------------------------------------------------
export async function sendOtp(req, res) {
  try {
    const { email } = req.body;

    if (await isResendLimited(email)) {
      return errorResponse(res, 429, "Too many OTP requests. Please wait a while and try again.");
    }

    const otp = await createOtp(email);
    await sendOtpEmail(email, otp);
    // Never log the OTP itself.

    return successResponse(res, 200, "OTP sent to your email.");
  } catch (err) {
    console.error("[auth.sendOtp]", err.message);
    return errorResponse(res, 500, "Could not send OTP right now. Please try again shortly.");
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/verify-otp
// ---------------------------------------------------------------------
export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    const result = await verifyOtpRecord(email, otp);

    if (!result.ok) {
      if (result.reason === "too_many_attempts") {
        return errorResponse(res, 429, "Too many incorrect attempts. Please request a new OTP.");
      }
      return errorResponse(res, 401, "That OTP is invalid or has expired. Please try again.");
    }

    return successResponse(res, 200, "Email verified successfully.");
  } catch (err) {
    console.error("[auth.verifyOtp]", err.message);
    return errorResponse(res, 500, "Could not verify OTP right now. Please try again shortly.");
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/login
// Checks the `users` table first, then `messes`, then `admins`.
// ---------------------------------------------------------------------
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const userResult = await query(
      `SELECT id, full_name, email, password_hash, email_verified
         FROM users WHERE email = $1`,
      [email]
    );
    if (userResult.rows.length > 0) {
      return finishLogin(res, userResult.rows[0], "user", password, {
        id: userResult.rows[0].id,
        fullName: userResult.rows[0].full_name,
        email: userResult.rows[0].email,
      });
    }

    const messResult = await query(
      `SELECT id, owner_name, mess_name, email, password_hash, email_verified
         FROM messes WHERE email = $1`,
      [email]
    );
    if (messResult.rows.length > 0) {
      return finishLogin(res, messResult.rows[0], "mess", password, {
        id: messResult.rows[0].id,
        ownerName: messResult.rows[0].owner_name,
        messName: messResult.rows[0].mess_name,
        email: messResult.rows[0].email,
      });
    }

    const adminResult = await query(
      `SELECT id, full_name, email, password_hash FROM admins WHERE email = $1`,
      [email]
    );
    if (adminResult.rows.length > 0) {
      return finishLogin(res, adminResult.rows[0], "admin", password, {
        id: adminResult.rows[0].id,
        fullName: adminResult.rows[0].full_name,
        email: adminResult.rows[0].email,
      });
    }

    return errorResponse(res, 401, "Invalid email or password.");
  } catch (err) {
    console.error("[auth.login]", err.message);
    return errorResponse(res, 500, "Something went wrong on our end. Please try again shortly.");
  }
}

async function finishLogin(res, record, role, password, profile) {
  const matches = await comparePassword(password, record.password_hash);
  if (!matches) {
    return errorResponse(res, 401, "Invalid email or password.");
  }
  if (role !== "admin" && !record.email_verified) {
    return errorResponse(res, 403, "Please verify your email before logging in.");
  }

  const token = signAccessToken({ id: record.id, role, email: record.email });
  setAuthCookie(res, token);

  return successResponse(res, 200, "Login successful.", {
    accessToken: token,
    userId: record.id,
    role,
    profile,
  });
}

// ---------------------------------------------------------------------
// GET /api/auth/me  (protected — requires authenticateJWT)
// Returns the logged-in account's profile, resolved by the role stored
// in the JWT. Demonstrates the authenticateJWT middleware protecting a
// real route; extend with authorizeUser/authorizeMessOwner/authorizeAdmin
// on future role-specific endpoints.
// ---------------------------------------------------------------------
export async function me(req, res) {
  try {
    const { id, role } = req.user;

    if (role === "user") {
      const result = await query(
        `SELECT id, full_name, college_name, roll_number, mobile, email, created_at
           FROM users WHERE id = $1`,
        [id]
      );
      if (!result.rows[0]) return errorResponse(res, 404, "Account not found.");
      return successResponse(res, 200, "Profile fetched.", { role, profile: result.rows[0] });
    }

    if (role === "mess") {
      const result = await query(
        `SELECT id, owner_name, mess_name, email, mobile, city, created_at
           FROM messes WHERE id = $1`,
        [id]
      );
      if (!result.rows[0]) return errorResponse(res, 404, "Account not found.");
      return successResponse(res, 200, "Profile fetched.", { role, profile: result.rows[0] });
    }

    const result = await query(
      `SELECT id, full_name, email, created_at FROM admins WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return errorResponse(res, 404, "Account not found.");
    return successResponse(res, 200, "Profile fetched.", { role, profile: result.rows[0] });
  } catch (err) {
    console.error("[auth.me]", err.message);
    return errorResponse(res, 500, "Something went wrong on our end. Please try again shortly.");
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------
export async function logout(req, res) {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return successResponse(res, 200, "Logged out successfully.");
}
