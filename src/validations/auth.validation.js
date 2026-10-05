import { z } from "zod";

// --- shared sub-schemas ---

const emailField = z
  .string()
  .email("Invalid email address")
  .transform((v) => v.toLowerCase().trim());

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

// --- registration: principal self-asserts email. (Alias migration deferred.) ---

export const registerSchoolSchema = z.object({
  schoolName: z.string().min(3, "School name must be at least 3 characters"),
  schoolCode: z
    .string()
    .min(2, "School code must be at least 2 characters")
    .transform((val) => val.toUpperCase()),
  emailDomain: z
    .string()
    .min(3, "Email domain must be valid (e.g. greenwood.edu)")
    .transform((val) => val.toLowerCase()),
  name: z.string().min(2, "Principal/Admin name must be at least 2 characters"),
  email: emailField,
  password: passwordField,
});

export const loginSchema = z.object({
  // identifier may be login alias OR contactEmail
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: passwordField,
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordField,
});

export const verifyEmailSchema = z.object({
  id: z.string().min(1, "Missing id"),
  token: z.string().min(1, "Missing token"),
});