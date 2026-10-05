import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  setAuthCookies,
  clearAuthCookies,
} from "../utils/cookies.js";
import {
  registerSchoolSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
} from "../validations/auth.validation.js";
import {
  registerSchoolService,
  loginUserService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
  refreshService,
  logoutService,
  verifyEmailService,
} from "../services/auth.service.js";
import { sendWelcomeEmail } from "../utils/email.js";
import env from "../config/env.js";

function reqMeta(req) {
  return {
    ua: req.headers["user-agent"] || "",
    ip: req.ip || req.connection?.remoteAddress || "",
  };
}

export const registerSchool = asyncHandler(async (req, res) => {
  const data = registerSchoolSchema.parse(req.body);
  const result = await registerSchoolService(data, reqMeta(req));

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return ApiResponse.success(
    res,
    "School registered successfully",
    {
      user: result.user,
      school: result.school,
    },
    201
  );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await loginUserService(email, password, reqMeta(req));

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return ApiResponse.success(res, "Login successful", {
    user: result.user,
    mustChangePassword: result.mustChangePassword,
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = req.user.toObject();
  delete user.password;

  if (user.schoolId && typeof user.schoolId === "object") {
    user.school = user.schoolId;
    user.emailDomain = user.schoolId.emailDomain;
    user.schoolId = user.schoolId._id;
  }
  return ApiResponse.success(res, "User profile retrieved", { user });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.refresh_token;
  const result = await refreshService(raw, reqMeta(req));

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return ApiResponse.success(res, "Session refreshed", { user: result.user });
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.refresh_token;
  await logoutService(raw);
  clearAuthCookies(res);
  return ApiResponse.success(res, "Logged out successfully");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const result = await forgotPasswordService(email);
  return ApiResponse.success(res, result.message, {
    devResetToken: result.devResetToken,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = resetPasswordSchema.parse(req.body);
  const result = await resetPasswordService(resetToken, newPassword);
  return ApiResponse.success(res, result.message);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
  const result = await changePasswordService(
    req.user._id,
    oldPassword,
    newPassword
  );
  return ApiResponse.success(res, result.message);
});

/**
 * Public — no `protect` middleware. Called from the user's verify-email
 * link. The link itself is the auth: only the holder of the unhashed token
 * can hit this, and the token is single-use.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { id, token } = verifyEmailSchema.parse(req.query);
  const result = await verifyEmailService({ userId: id, rawToken: token }, reqMeta(req));

  // Welcome email with the temp password — fire and forget. We must send it
  // here because the plaintext temp password only exists in the invite
  // payload that we just consumed; it never returns to the client.
  if (result.plainTempPassword && result.user.contactEmail) {
    try {
      await sendWelcomeEmail({
        to: result.user.contactEmail,
        name: result.user.name,
        role:
          result.user.roleProfileModel === "Student"
            ? "Student"
            : result.user.roleProfileModel === "Teacher"
            ? "Teacher"
            : "User",
        alias: result.user.email,
        tempPassword: result.plainTempPassword,
        loginUrl: `${env.FRONTEND_URL}/login`,
      });
    } catch (err) {
      // Don't fail verification because email failed — log and move on.
      console.error("Welcome email failed:", err.message);
    }
  }

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return ApiResponse.success(res, "Email verified. You are now signed in.", {
    user: result.user,
    mustChangePassword: result.mustChangePassword,
  });
});