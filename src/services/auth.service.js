import crypto from "crypto";
import { hashPassword, comparePassword } from "../lib/bcrypt.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefresh,
} from "../lib/jwt.js";
import { hashToken, generateRawToken } from "../utils/tokens.js";
import AppError from "../utils/AppError.js";
import { sendPasswordResetEmail } from "../utils/email.js";
import env from "../config/env.js";
import User from "../models/User.js";
import School from "../models/School.js";
import RefreshToken from "../models/RefreshToken.js";
import { ROLES, RESET_TTL_MS } from "../models/constants.js";

/* ===========================
   Helpers
=========================== */

/**
 * Issue an access + refresh token pair, persist the refresh row, and return
 * the raw tokens. Callers wrap in cookie helpers / response object.
 */
async function issueTokenPair(user, { ua = "", ip = "" } = {}) {
  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    role: user.role,
    schoolId: user.schoolId ? user.schoolId.toString() : null,
    slug: user.slug,
  });
  const { token: refreshToken, jti } = generateRefreshToken({
    sub: user._id.toString(),
  });
  const refreshHash = hashToken(refreshToken);

  await RefreshToken.create({
    tokenHash: refreshHash,
    userId: user._id,
    jti,
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_MS),
    ua,
    ip,
  });

  return { accessToken, refreshToken };
}

/* ===========================
   Register School & Admin
=========================== */
export async function registerSchoolService(data, reqMeta = {}) {
  const emailExists = await User.findOne({ email: data.email.toLowerCase() });
  if (emailExists) {
    throw new AppError("Email already registered", 400);
  }

  const codeExists = await School.findOne({
    schoolCode: data.schoolCode.toUpperCase(),
  });
  if (codeExists) {
    throw new AppError("School code already exists", 400);
  }

  const domainExists = await School.findOne({
    emailDomain: data.emailDomain.toLowerCase(),
  });
  if (domainExists) {
    throw new AppError("Email domain already registered", 400);
  }

  const hashedPassword = await hashPassword(data.password);
  const userSlug = await User.generateUniqueUserSlug();

  // The principal's User.email is their REAL email at registration time.
  // (Note: principals are not assigned an alias here — they self-asserted the
  // email at registration. Moving to an alias later is a separate iteration.)
  const user = await User.create({
    name: data.name,
    slug: userSlug,
    email: data.email.toLowerCase(),
    contactEmail: data.email.toLowerCase(),
    password: hashedPassword,
    role: ROLES.SCHOOL,
    // Principal self-asserts registration — not gated behind email
    // verification in this iteration (flagged as future work).
    emailVerified: true,
    mustChangePassword: false,
  });

  const schoolSlug = await School.generateUniqueSchoolSlug();
  const school = await School.create({
    slug: schoolSlug,
    schoolName: data.schoolName,
    schoolCode: data.schoolCode,
    emailDomain: data.emailDomain,
    owner: user._id,
  });

  user.schoolId = school._id;
  await user.save();

  const tokens = await issueTokenPair(user, reqMeta);
  const userObject = user.toObject();
  delete userObject.password;

  return {
    ...tokens,
    user: userObject,
    school,
  };
}

/* ===========================
   Login
=========================== */
export async function loginUserService(identifier, password, reqMeta = {}) {
  // Identifier may be either the login alias (`User.email`) or the contact
  // email. Either way the same password set on the account works.
  const lookup = String(identifier || "").trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: lookup }, { contactEmail: lookup }],
  })
    .select("+password")
    .populate("schoolId", "schoolName emailDomain schoolCode");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account has been deactivated. Please contact your school administrator.",
      403
    );
  }

  // Email verification gate. Principal-provisioned users (STUDENT/TEACHER)
  // have emailVerified=false until they click the verify link in their email.
  if (!user.emailVerified) {
    throw new AppError(
      "Please verify your email first. Check your inbox for the verification link.",
      401
    );
  }

  // Profile gate. After verification the Student/Teacher record exists and
  // User.roleProfileId is set. Until that happens the user can't sign in to
  // the role-specific dashboard.
  if (
    user.role !== ROLES.SCHOOL &&
    user.role !== ROLES.SUPER_ADMIN &&
    !user.roleProfileId
  ) {
    throw new AppError(
      "Your profile is still being set up. Please complete verification first.",
      401
    );
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  user.lastLogin = new Date();
  await user.save();

  const tokens = await issueTokenPair(user, reqMeta);

  const userObject = user.toObject();
  delete userObject.password;
  if (userObject.schoolId && typeof userObject.schoolId === "object") {
    userObject.school = userObject.schoolId;
    userObject.emailDomain = userObject.schoolId.emailDomain;
    userObject.schoolId = userObject.schoolId._id;
  }

  return {
    ...tokens,
    user: userObject,
    mustChangePassword: user.mustChangePassword,
  };
}

/* ===========================
   Email Verification
=========================== */
/**
 * Called when the user clicks the verification link. Validates the raw
 * token, marks the User verified, and (for principal-invited users)
 * materializes the role-specific Student/Teacher record from the embedded
 * `metadata.invitePayload`.
 *
 * Returns the same shape as login so the client can auto-sign-in.
 */
export async function verifyEmailService({ userId, rawToken }, reqMeta = {}) {
  if (!userId || !rawToken) {
    throw new AppError("Verification link is incomplete", 400);
  }

  const tokenHash = hashToken(rawToken);
  const user = await User.findOne({
    _id: userId,
    verificationToken: tokenHash,
    verificationExpires: { $gt: new Date() },
  }).select("+verificationToken");

  if (!user) {
    throw new AppError("Invalid or expired verification link", 400);
  }

  user.emailVerified = true;
  user.verificationToken = null;
  user.verificationExpires = null;

  // Materialize the role profile if the principal invited this user.
  // The payload was stashed in `metadata.invitePayload` at invite time.
  const invite = user.metadata && user.metadata.invitePayload;
  if (invite && invite.roleModel && !user.roleProfileId) {
    const profile = await _createRoleProfileFromInvite(user, invite);
    user.roleProfileId = profile._id;
    user.roleProfileModel = invite.roleModel;
  }

  // The invite payload has been consumed.
  if (user.metadata) {
    delete user.metadata.invitePayload;
  }
  await user.save();

  const tokens = await issueTokenPair(user, reqMeta);
  const userObject = user.toObject();
  delete userObject.password;
  if (userObject.schoolId && typeof userObject.schoolId === "object") {
    userObject.school = userObject.schoolId;
    userObject.emailDomain = userObject.schoolId.emailDomain;
    userObject.schoolId = userObject.schoolId._id;
  }

  return {
    ...tokens,
    user: userObject,
    mustChangePassword: user.mustChangePassword,
    // The plaintext temp password is included so the caller can send the
    // welcome email. The caller MUST email it; we never return it again.
    plainTempPassword: invite ? invite.tempPassword : null,
  };
}

/* ===========================
   Forgot / Reset Password
=========================== */
export async function forgotPasswordService(contactEmail) {
  const lookup = String(contactEmail || "").trim().toLowerCase();
  // Always respond with a generic message — don't leak whether the email exists.
  const genericMessage =
    "If an account exists with that email, password reset instructions have been sent.";

  const user = await User.findOne({ contactEmail: lookup });
  if (!user) {
    return { message: genericMessage };
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  await User.findByIdAndUpdate(user._id, {
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: new Date(Date.now() + RESET_TTL_MS),
  });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail({
    to: user.contactEmail,
    name: user.name,
    resetUrl,
  });

  const result = { message: genericMessage };
  // Only leak the token in non-prod environments, for local testing.
  if (env.NODE_ENV !== "production") {
    result.devResetToken = rawToken;
  }
  return result;
}

export async function resetPasswordService(rawToken, newPassword) {
  if (!rawToken) throw new AppError("Reset token is required", 400);

  const tokenHash = hashToken(rawToken);
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: Date.now() },
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid or expired password reset token", 400);
  }

  const hashed = await hashPassword(newPassword);
  await User.findByIdAndUpdate(user._id, {
    password: hashed,
    mustChangePassword: false,
    resetPasswordTokenHash: null,
    resetPasswordExpires: null,
  });

  // Force-revoke all refresh tokens: anyone with the old password (or anyone
  // who stole the cookie) is now logged out everywhere.
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() }
  );

  return {
    message: "Password reset successfully. You can now log in with your new password.",
  };
}

/* ===========================
   Change Password
=========================== */
export async function changePasswordService(userId, oldPassword, newPassword) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("User not found", 404);

  const isMatch = await comparePassword(oldPassword, user.password);
  if (!isMatch) throw new AppError("Current password is incorrect", 400);

  const hashed = await hashPassword(newPassword);
  await User.findByIdAndUpdate(user._id, {
    password: hashed,
    mustChangePassword: false,
    resetPasswordTokenHash: null,
    resetPasswordExpires: null,
  });

  // Logout everywhere else.
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() }
  );

  return { message: "Password changed successfully" };
}

/* ===========================
   Refresh (rotate)
=========================== */
export async function refreshService(rawRefreshToken, reqMeta = {}) {
  if (!rawRefreshToken) throw new AppError("Missing refresh token", 401);

  let decoded;
  try {
    decoded = verifyRefresh(rawRefreshToken);
  } catch (err) {
    throw new AppError("Invalid or expired session", 401);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    // Possible token reuse → revoke ALL of this user's tokens.
    if (stored) {
      await RefreshToken.updateMany(
        { userId: stored.userId, revokedAt: null },
        { revokedAt: new Date() }
      );
    }
    throw new AppError("Session expired or revoked", 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new AppError("User not found or deactivated", 401);
  }

  // Rotate.
  stored.revokedAt = new Date();
  await stored.save();

  const tokens = await issueTokenPair(user, reqMeta);

  const userObject = user.toObject();
  delete userObject.password;
  if (userObject.schoolId && typeof userObject.schoolId === "object") {
    userObject.school = userObject.schoolId;
    userObject.emailDomain = userObject.schoolId.emailDomain;
    userObject.schoolId = userObject.schoolId._id;
  }

  return { ...tokens, user: userObject };
}

/* ===========================
   Logout
=========================== */
export async function logoutService(rawRefreshToken) {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date() }
    );
  }
  return { message: "Logged out successfully" };
}

/* ===========================
   Internal — used by verifyEmailService
=========================== */
async function _createRoleProfileFromInvite(user, invite) {
  // Lazy import to avoid a circular dep through models.
  const Student = (await import("../models/Student.js")).default;
  const Teacher = (await import("../models/Teacher.js")).default;
  const Staff = (await import("../models/Staff.js")).default;

  if (invite.roleModel === "Student") {
    const slug = await Student.generateUniqueStudentSlug();
    return Student.create({
      slug,
      userId: user._id,
      schoolId: invite.schoolId,
      rollNumber: invite.rollNumber,
      firstName: invite.firstName,
      middleName: invite.middleName || "",
      lastName: invite.lastName,
      motherName: invite.motherName || "",
      gradeClass: invite.gradeClass,
      section: invite.section || "A",
      gender: invite.gender,
      dateOfBirth: invite.dateOfBirth
        ? new Date(invite.dateOfBirth)
        : undefined,
      parentName: invite.parentName || "",
      parentEmail: invite.contactEmail || "",
      parentPhone: invite.parentPhone || "",
      address: invite.address || "",
      assignedTeacherId: invite.assignedTeacherId || null,
    });
  }
  if (invite.roleModel === "Teacher") {
    const slug = await Teacher.generateUniqueTeacherSlug();
    return Teacher.create({
      slug,
      userId: user._id,
      schoolId: invite.schoolId,
      employeeId: invite.employeeId,
      firstName: invite.firstName,
      lastName: invite.lastName,
      gender: invite.gender,
      phone: invite.phone || "",
      qualification: invite.qualification || "",
      experience: invite.experience || 0,
      subjects: invite.subjects || [],
    });
  }
  if (invite.roleModel === "Staff") {
    const slug = await Staff.generateUniqueStaffSlug();
    return Staff.create({
      slug,
      userId: user._id,
      schoolId: invite.schoolId,
      employeeId: invite.employeeId,
      firstName: invite.firstName,
      lastName: invite.lastName,
      gender: invite.gender,
      phone: invite.phone || "",
      qualification: invite.qualification || "",
      experience: invite.experience || 0,
      staffType: invite.staffType,
      customTitle: invite.customTitle || "",
      department: invite.department || "",
    });
  }
  throw new AppError(`Unknown roleModel in invite payload: ${invite.roleModel}`, 500);
}