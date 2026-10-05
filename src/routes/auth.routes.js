import { Router } from "express";
import {
  registerSchool,
  login,
  me,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Public.
router.post("/register-school", registerSchool);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
// verifyEmail is intentionally public — the token IS the auth.
// In a later iteration we may add rate limiting here.
router.get("/verify-email", verifyEmail);

// Cookie-rotation. Public on the route — the refresh cookie IS the auth.
router.post("/refresh", refresh);

// Protected.
router.use(protect);
router.get("/me", me);
router.post("/change-password", changePassword);
router.post("/logout", logout);

export default router;