// =====================================================================
// Password hashing helpers. Centralized here so the salt-round count
// is defined once and every caller stays consistent.
// =====================================================================
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
