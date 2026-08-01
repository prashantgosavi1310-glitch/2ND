// =====================================================================
// User controller — POST /api/user/register
// =====================================================================
import { query } from "../config/database.js";
import { hashPassword } from "../utils/password.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { cleanupUploadedFiles, relativeUploadPath } from "../middleware/upload.js";
import { consumeVerifiedOtp } from "../services/otp.service.js";

export async function registerUser(req, res) {
  const files = req.files;
  try {
    const { fullName, collegeName, rollNumber, mobile, email, password } = req.body;

    const emailVerified = await consumeVerifiedOtp(email);
    if (!emailVerified) {
      cleanupUploadedFiles(files);
      return errorResponse(res, 401, "Please verify your email before registering.");
    }

    const existing = await query(
      `SELECT id FROM users WHERE email = $1 OR mobile = $2`,
      [email, mobile]
    );
    if (existing.rows.length > 0) {
      cleanupUploadedFiles(files);
      return errorResponse(res, 409, "That email or mobile number is already registered.");
    }

    const passwordHash = await hashPassword(password);
    const userPhotoPath = files?.userPhoto?.[0] ? relativeUploadPath(files.userPhoto[0]) : null;
    const collegeIdPath = files?.collegeId?.[0] ? relativeUploadPath(files.collegeId[0]) : null;

    const result = await query(
      `INSERT INTO users (
         full_name, college_name, roll_number, mobile, email,
         password_hash, user_photo_path, college_id_path, email_verified
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, TRUE)
       RETURNING id, full_name, college_name, roll_number, mobile, email, created_at`,
      [fullName, collegeName, rollNumber, mobile, email, passwordHash, userPhotoPath, collegeIdPath]
    );

    return successResponse(res, 201, "Registration successful.", { user: result.rows[0] });
  } catch (err) {
    cleanupUploadedFiles(files);
    if (err.code === "23505") {
      return errorResponse(res, 409, "That email or mobile number is already registered.");
    }
    console.error("[user.registerUser]", err.message);
    return errorResponse(res, 500, "Something went wrong on our end. Please try again shortly.");
  }
}
