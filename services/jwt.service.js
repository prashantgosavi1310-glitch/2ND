// =====================================================================
// JWT service — signs and verifies access tokens.
// Payload carries only what authorization checks need: id, role, email.
// Never put the password hash or anything sensitive in the token; it
// is base64-encoded, not encrypted, and readable by anyone who has it.
// =====================================================================
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  console.error("[jwt] JWT_SECRET is not set. Check your .env file.");
}

/**
 * @param {{ id: string, role: 'user'|'mess'|'admin', email: string }} payload
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Throws if the token is invalid or expired — callers should try/catch
 * (the auth middleware does this and turns it into a 401 response).
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
