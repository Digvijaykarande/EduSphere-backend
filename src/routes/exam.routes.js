import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles as authorize } from "../middleware/role.middleware.js";
import {
  createExamHandler,
  getExamsHandler,
  getExamHandler,
  updateExamHandler,
  deleteExamHandler,
  getGradebookHandler,
  saveMarksHandler,
  getResultsQueueHandler,
  publishResultsHandler,
  getStatsHandler,
  getUpcomingHandler,
  getRecentResultsHandler,
  getTopPerformersHandler,
  getAnalyticsHandler,
  getAtRiskStudentsHandler,
  getStudentOverviewHandler,
} from "../controllers/exam.controller.js";

const router = Router();

router.use(protect);

// Student-facing overview (any authenticated student).
router.get("/student/overview", authorize("STUDENT"), getStudentOverviewHandler);

// Principal + Teacher can create/manage exams. Ownership (which
// teacher may touch which exam) is enforced inside the service layer via
// TeacherAssignment, not here.
router.post("/", authorize("SCHOOL", "TEACHER"), createExamHandler);
router.get("/", authorize("SCHOOL", "TEACHER"), getExamsHandler);

// Overview / dashboard widgets — read-only for principal + teacher.
router.get("/stats", authorize("SCHOOL", "TEACHER"), getStatsHandler);
router.get("/upcoming", authorize("SCHOOL", "TEACHER"), getUpcomingHandler);
router.get("/recent-results", authorize("SCHOOL", "TEACHER"), getRecentResultsHandler);
router.get("/top-performers", authorize("SCHOOL", "TEACHER"), getTopPerformersHandler);
router.get("/analytics", authorize("SCHOOL", "TEACHER"), getAnalyticsHandler);
router.get("/at-risk-students", authorize("SCHOOL", "TEACHER"), getAtRiskStudentsHandler);
router.get("/results-queue", authorize("SCHOOL", "TEACHER"), getResultsQueueHandler);

router.get("/:id", authorize("SCHOOL", "TEACHER"), getExamHandler);
router.patch("/:id", authorize("SCHOOL", "TEACHER"), updateExamHandler);
router.delete("/:id", authorize("SCHOOL", "TEACHER"), deleteExamHandler);

router.get("/:id/gradebook", authorize("SCHOOL", "TEACHER"), getGradebookHandler);
router.post("/:id/marks", authorize("SCHOOL", "TEACHER"), saveMarksHandler);
router.patch("/:id/publish", authorize("SCHOOL", "TEACHER"), publishResultsHandler);

export default router;
