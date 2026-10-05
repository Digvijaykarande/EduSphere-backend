import crypto from "crypto";

/**
 * sha256 of `raw`, returned as hex. Used for storing one-time tokens
 * (email verification, password reset, refresh tokens) so that a DB dump
 * alone is not enough to use them.
 */
export function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

/**
 * Generate a cryptographically random token string, default 32 bytes → 64 hex chars.
 */
export function generateRawToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}
