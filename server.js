import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import env from "./src/config/env.js";
import { connectDB } from "./src/config/mongodb.js";
import authRoutes from "./src/routes/auth.routes.js";
import schoolRoutes from "./src/routes/school.routes.js";
import teacherRoutes from "./src/routes/teacher.routes.js";
import studentRoutes from "./src/routes/student.routes.js";
import events from "./src/routes/event.routes.js"
import attendanceRoutes from "./src/routes/attendance.routes.js";
import leaveRoutes from "./src/routes/leave.routes.js";
import assignmentsRoutes from "./src/routes/assignments.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import feesRoutes from "./src/routes/fees.routes.js";
import examRoutes from "./src/routes/exam.routes.js";
import studentFeesRoutes from "./src/routes/studentFees.routes.js";
import { errorHandler } from "./src/middleware/error.middleware.js";
import {
  loginLimiter,
  forgotPasswordLimiter,
  verifyEmailLimiter,
  registerSchoolLimiter,
} from "./src/middleware/rateLimit.js";

const app = express();

// Behind helmet — but disable CSP in dev so Next.js iframe previews + Vite
// style injections don't break. In prod, set the CSP via your CDN / hosting
// layer so you can tune it per environment.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — must allow credentials so the httpOnly cookie round-trips.
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Body parsers with sane size limits.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// Health
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "EduSphere Backend API",
    timestamp: new Date().toISOString(),
  });
});

// Public rate-limited auth endpoints.
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/verify-email", verifyEmailLimiter);
app.use("/api/auth/register-school", registerSchoolLimiter);

// API
app.use("/api/auth", authRoutes);
// More-specific /api/school/* mounts MUST come before /api/school (schoolRoutes),
// which is gated to SCHOOL-only via a global authorizeRoles. Express matches
// app.use prefixes in order, so mounting schoolRoutes first would shadow these
// sub-paths and 403 any non-SCHOOL role (e.g. a TEACHER viewing the fees
// dashboard) before the request ever reaches the intended router.
app.use("/api/school/events", events);
app.use("/api/school/fees", feesRoutes);   // TEACHER + SCHOOL read access
app.use("/api/school", schoolRoutes);
// Likewise, /api/student/fees before /api/student for consistent precedence.
app.use("/api/student/fees", studentFeesRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/exams", examRoutes);


// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
});

// Global error handler
app.use(errorHandler);

const PORT = env.PORT;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`EduSphere Express Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
});

export default app;