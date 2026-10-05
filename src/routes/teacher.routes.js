import { Router } from "express";
import { getMyAssignmentsHandler } from "../controllers/teacherAssignment.controller.js";
import {
  getRosterHandler,
  markAttendanceHandler,
} from "../controllers/attendance.controller.js";
import {
  createAssignmentHandler,
  getMyCreatedAssignmentsHandler,
  gradeSubmissionHandler,
} from "../controllers/assignment.controller.js";
import {
  upsertSlotHandler,
  deleteSlotHandler,
  getMyTeacherScheduleHandler,
} from "../controllers/timetable.controller.js";
import {
  upsertSyllabusHandler,
  getMyTeacherSyllabusHandler,
} from "../controllers/syllabus.controller.js";
import {
  createMaterialHandler,
  getMyTeacherMaterialsHandler,
  deleteMaterialHandler,
} from "../controllers/material.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

// Everything here is self-service for a logged-in TEACHER only. SCHOOL
// intentionally has no access to these routes — attendance marking is
// structurally unreachable for the SCHOOL role, not just role-checked.
router.use(protect);
router.use(authorizeRoles(ROLES.TEACHER));

router.get("/my-assignments", getMyAssignmentsHandler);

router.get("/attendance/roster", getRosterHandler);
router.post("/attendance/mark", markAttendanceHandler);

// Homework/assignments this teacher has created, and grading.
router.post("/assignments", createAssignmentHandler);
router.get("/assignments", getMyCreatedAssignmentsHandler);
router.patch("/assignments/:slug/submissions/:studentSlug/grade", gradeSubmissionHandler);

// Timetable — this teacher's own schedule across all their sections.
router.get("/schedule", getMyTeacherScheduleHandler);
router.post("/schedule/slots", upsertSlotHandler);
router.delete("/schedule/slots/:id", deleteSlotHandler);

// Syllabus tracking — this teacher's own subjects.
router.post("/syllabus", upsertSyllabusHandler);
router.get("/syllabus", getMyTeacherSyllabusHandler);

// Study materials this teacher has posted.
router.post("/materials", createMaterialHandler);
router.get("/materials", getMyTeacherMaterialsHandler);
router.delete("/materials/:slug", deleteMaterialHandler);

export default router;
