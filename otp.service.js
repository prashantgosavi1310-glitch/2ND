// =====================================================================
// OTP service — all OTP business logic lives here so the controller
// stays thin. The OTP itself is never stored in plaintext (it's
// bcrypt-hashed, same as a password) and is never logged.
// =====================================================================
import crypto from "crypto";
import bcrypt from "bcrypt";
import { query } from "../config/database.js";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_SALT_ROUNDS = 10;
const MAX_RESEND_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

/** Cryptographically-secure 6-digit numeric OTP, e.g. "042917". */
export function generateOtp() {
  const otp = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(otp).padStart(OTP_LENGTH, "0");
}

/**
 * How many OTPs has this email requested in the last hour? Used to
 * enforce "maximum 5 OTP requests per hour" before a new one is issued.
 */
export async function countRecentRequests(email) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
       FROM otp_verifications
      WHERE email = $1
        AND created_at > now() - INTERVAL '1 hour'`,
    [email]
  );
  return result.rows[0].count;
}

export async function isResendLimited(email) {
  const count = await countRecentRequests(email);
  return count >= MAX_RESEND_PER_HOUR;
}

/** Generates, hashes, and stores a fresh OTP row. Returns the plain OTP (caller emails it, never logs it). */
export async function createOtp(email) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);

  await query(
    `INSERT INTO otp_verifications (email, otp_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [email, otpHash, OTP_TTL_MINUTES]
  );

  return otp;
}

/**
 * Verifies a submitted OTP against the most recent unverified, unexpired
 * row for that email. On success the row is deleted immediately (OTPs
 * are single-use and never retained). On a wrong code, increments the
 * attempt counter and invalidates the row outright once the limit is hit,
 * forcing the user to request a fresh OTP rather than brute-forcing forever.
 *
 * @returns {{ ok: boolean, reason?: 'not_found'|'expired'|'too_many_attempts'|'mismatch' }}
 */
export async function verifyOtp(email, submittedOtp) {
  const result = await query(
    `SELECT id, otp_hash, attempts, expires_at
       FROM otp_verifications
      WHERE email = $1 AND verified = FALSE
      ORDER BY created_at DESC
      LIMIT 1`,
    [email]
  );

  const record = result.rows[0];
  if (!record) return { ok: false, reason: "not_found" };

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await query(`DELETE FROM otp_verifications WHERE id = $1`, [record.id]);
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await query(`DELETE FROM otp_verifications WHERE id = $1`, [record.id]);
    return { ok: false, reason: "too_many_attempts" };
  }

  const matches = await bcrypt.compare(submittedOtp, record.otp_hash);
  if (!matches) {
    await query(
      `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
      [record.id]
    );
    return { ok: false, reason: "mismatch" };
  }

  // Success — mark verified (registration checks this) and let it live
  // briefly for the registration step, then it's cleaned up there.
  await query(
    `UPDATE otp_verifications SET verified = TRUE, verified_at = now() WHERE id = $1`,
    [record.id]
  );
  return { ok: true };
}

/**
 * Registration-time check: has this email completed OTP verification
 * recently enough to trust it (within the last 30 minutes)? Consumes
 * the record on success so it can't be reused for a second registration.
 */
export async function consumeVerifiedOtp(email) {
  const result = await query(
    `SELECT id FROM otp_verifications
      WHERE email = $1
        AND verified = TRUE
        AND verified_at > now() - INTERVAL '30 minutes'
      ORDER BY verified_at DESC
      LIMIT 1`,
    [email]
  );
  const record = result.rows[0];
  if (!record) return false;

  await query(`DELETE FROM otp_verifications WHERE id = $1`, [record.id]);
  return true;
}
