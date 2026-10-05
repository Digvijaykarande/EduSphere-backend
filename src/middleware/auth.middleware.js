import { verifyAccess } from "../lib/jwt.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Cookie-only authentication. The httpOnly `access_token` cookie is the single
 * source of truth at the API edge. The Bearer-header path is gone — every
 * caller (including the Next.js route handlers we use as proxies) goes through
 * cookies now.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.access_token;
  if (!token) {
    throw new AppError("Not authenticated", 401);
  }

  let decoded;
  try {
    decoded = verifyAccess(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Session expired", 401);
    }
    throw new AppError("Invalid session", 401);
  }

  // `sub` is the userId in access tokens (see lib/jwt.js).
  const user = await User.findById(decoded.sub).populate(
    "schoolId",
    "schoolName emailDomain schoolCode"
  );

  if (!user || !user.isActive) {
    throw new AppError("User account not found or deactivated", 401);
  }

  req.user = user;
  next();
});