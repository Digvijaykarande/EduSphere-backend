import dotenv from "dotenv";

dotenv.config();

// Parse TTLs like "15m", "7d", "24h" into milliseconds. Used for cookie Max-Age
// and DB-stored expiry fields.
function parseTtlMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const m = String(value).trim().match(/^(\d+)\s*([smhd])$/);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * mult;
}

const env = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/edusphere",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV || "development",

  // --- JWT secrets (split access + refresh) ---
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    "edusphere_access_secret_change_me_in_prod",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    "edusphere_refresh_secret_change_me_in_prod",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  JWT_ACCESS_TTL_MS: parseTtlMs(process.env.JWT_ACCESS_EXPIRES_IN, 15 * 60_000),
  JWT_REFRESH_TTL_MS: parseTtlMs(
    process.env.JWT_REFRESH_EXPIRES_IN,
    7 * 86_400_000
  ),

  // --- One-time tokens (verification, password reset) ---
  EMAIL_VERIFICATION_TTL: process.env.EMAIL_VERIFICATION_TTL || "24h",

  // --- Cookies ---
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || "",

  // --- Login alias generator ---
  // Used to mint display-only addresses of the form
  // `<first>.<last>.<uid>@<PUBLIC_DOMAIN>`. Must NEVER receive mail.
  PUBLIC_DOMAIN: process.env.PUBLIC_DOMAIN || "edusphere.app",

  // --- Nodemailer ---
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  EMAIL_FROM:
    process.env.EMAIL_FROM || '"EduSphere Admin" no-reply@edusphere.app',

  // --- Cloudinary (file uploads: assignment attachments, submissions) ---
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
};

export default env;
