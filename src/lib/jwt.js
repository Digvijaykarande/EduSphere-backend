import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import env from "../config/env.js";

/**
 * Sign a short-lived access JWT. Verified by the `protect` middleware on every
 * protected API call. Stateless — no DB lookup.
 */
export function generateAccessToken({ sub, role, schoolId, slug }) {
  return jwt.sign(
    { sub, role, schoolId: schoolId || null, slug: slug || null },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

/**
 * Sign a long-lived refresh JWT carrying a `jti`. The raw value is sent to
 * the client in an httpOnly cookie; we persist only `sha256(raw)` plus `jti`
 * in the `RefreshToken` collection so rotation can be enforced.
 */
export function generateRefreshToken({ sub, jti }) {
  const id = jti || randomUUID();
  return {
    token: jwt.sign({ sub, jti: id, typ: "refresh" }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    }),
    jti: id,
  };
}

export function verifyAccess(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefresh(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}