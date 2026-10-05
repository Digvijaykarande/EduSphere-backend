import { Router } from "express";
import {
  getMyVisibleAssignmentsHandler,
  submitAssignmentHandler,
} from "../controllers/assignment.controller.js";
import { getMyStudentTimetableHandler } from "../controllers/timetable.controller.js";
import { getMyStudentSyllabusHandler } from "../controllers/syllabus.controller.js";
import { getMyStudentMaterialsHandler } from "../controllers/material.controller.js";
import {
  createDiaryEntryHandler,
  getMyDiaryEntriesHandler,
  deleteDiaryEntryHandler,
} from "../controllers/studyDiary.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

router.use(protect);
router.use(authorizeRoles(ROLES.STUDENT));

router.get("/assignments", getMyVisibleAssignmentsHandler);
router.post("/assignments/:slug/submit", submitAssignmentHandler);

router.get("/timetable", getMyStudentTimetableHandler);
router.get("/syllabus", getMyStudentSyllabusHandler);
router.get("/materials", getMyStudentMaterialsHandler);

// Study diary — fully personal, never visible to any other role.
router.post("/diary", createDiaryEntryHandler);
router.get("/diary", getMyDiaryEntriesHandler);
router.delete("/diary/:id", deleteDiaryEntryHandler);

export default router;
