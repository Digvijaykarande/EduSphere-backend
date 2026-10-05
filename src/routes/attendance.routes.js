import { Router } from "express";
import {
  getStudentHistoryHandler,
  getSectionSummaryHandler,
  getSchoolTrendHandler,
  getSchoolStatsHandler,
  getMyAttendanceHandler,
  getMyTodaySummariesHandler,
  getSchoolSectionsHandler,
  getSectionRosterHandler,
} from "../controllers/attendance.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

router.use(protect);

// Self-service — STUDENT viewing their own attendance. Mounted before
// /student/:slug so "mine" is never swallowed as a slug param.
router.get("/mine", authorizeRoles(ROLES.STUDENT), getMyAttendanceHandler);

// Self-service — TEACHER's today's attendance summary across all their
// sections, used by the Academics AttendanceSummary widget.
router.get("/today-summaries", authorizeRoles(ROLES.TEACHER), getMyTodaySummariesHandler);

// Student attendance history — self (STUDENT), or any TEACHER/SCHOOL in the
// same school. Self-only enforcement for STUDENT happens in the controller,
// since it needs to compare against the caller's own Student profile.
router.get(
  "/student/:slug",
  authorizeRoles(ROLES.STUDENT, ROLES.TEACHER, ROLES.SCHOOL),
  getStudentHistoryHandler
);

// Section-day summary — TEACHER (their own sections only, enforced in the
// controller via assertTeacherOwnsSection) and SCHOOL (any section).
router.get(
  "/section-summary",
  authorizeRoles(ROLES.TEACHER, ROLES.SCHOOL),
  getSectionSummaryHandler
);

// All active sections school-wide with today's counts — powers the
// Principal's class/section drill-down list. SCHOOL only: a teacher browsing
// sections they don't teach isn't a supported flow (they use "My Sections").
router.get("/sections", authorizeRoles(ROLES.SCHOOL), getSchoolSectionsHandler);

// Full roster + overall attendance % for one section — SCHOOL (any section)
// or TEACHER (their own sections only, enforced in the controller).
router.get(
  "/sections/:sectionId/roster",
  authorizeRoles(ROLES.TEACHER, ROLES.SCHOOL),
  getSectionRosterHandler
);

// School-wide daily trend — SCHOOL (view-only) exclusively. There is
// deliberately no attendance-marking route reachable by SCHOOL anywhere in
// this router or in teacher.routes.js.
router.get("/school-trend", authorizeRoles(ROLES.SCHOOL), getSchoolTrendHandler);

// School-wide snapshot counters (teachers, students, sections, avg
// attendance) — powers the Principal dashboard's top metric cards.
router.get("/school-stats", authorizeRoles(ROLES.SCHOOL), getSchoolStatsHandler);

export default router;