import rateLimit from "express-rate-limit";

/**
 * Per-IP rate limits for sensitive endpoints. We keep these narrow on
 * purpose — a SaaS used by hundreds of schools behind NATs would otherwise
 * lock out whole schools on a single bad login. If we ever need per-user
 * throttling (e.g. lockout after N failed logins on the same email) it goes
 * in a separate `attemptTracker` middleware, not here.
 */

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many password reset requests. Please try again in an hour.",
  },
});

export const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again in an hour.",
  },
});

export const registerSchoolLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many school registrations from this IP. Please try again later.",
  },
});