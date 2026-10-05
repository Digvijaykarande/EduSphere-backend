import { Router } from "express";
import {
  createTeacher,
  getTeachers,
  updateTeacher,
  deleteTeacher,
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
  updateSchool,
} from "../controllers/school.controller.js";
import {
  createSectionHandler,
  getSections,
  getSection,
  updateSectionHandler,
  deleteSectionHandler,
} from "../controllers/section.controller.js";
import {
  createAssignmentHandler,
  getAssignmentsHandler,
  updateAssignmentHandler,
  deleteAssignmentHandler,
} from "../controllers/teacherAssignment.controller.js";
import {
  principalUpsertSlotHandler,
  principalDeleteSlotHandler,
  getSectionTimetableHandler,
  getTeacherTimetableHandler,
} from "../controllers/timetable.controller.js";
import {
  createWingHandler,
  getWingsHandler,
  updateWingHandler,
  deleteWingHandler,
  reorderWingsHandler,
} from "../controllers/wing.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

// All school-management routes require an authed SCHOOL or SUPER_ADMIN.
router.use(protect);
router.use(authorizeRoles(ROLES.SCHOOL, ROLES.SUPER_ADMIN));

// Teacher management — identified by slug, not _id.
router.post("/teachers", createTeacher);
router.get("/teachers", getTeachers);
router.patch("/teachers/:slug", updateTeacher);
router.delete("/teachers/:slug", deleteTeacher);

// Student management — symmetric.
router.post("/students", createStudent);
router.get("/students", getStudents);
router.patch("/students/:slug", updateStudent);
router.delete("/students/:slug", deleteStudent);

// Staff management (Lab Assistant, Librarian, Cashier, etc.) — symmetric.
router.post("/staff", createStaff);
router.get("/staff", getStaff);
router.patch("/staff/:slug", updateStaff);
router.delete("/staff/:slug", deleteStaff);

// Sections (Class 10 - Section A, etc.) — identified by slug.
router.post("/sections", createSectionHandler);
router.get("/sections", getSections);
router.get("/sections/:slug", getSection);
router.patch("/sections/:slug", updateSectionHandler);
router.delete("/sections/:slug", deleteSectionHandler);

// Teacher-to-class-subject allocation — the "Allocate Teacher to Class" form.
// Identified by Mongo _id since these rows are never surfaced by slug in the UI.
router.post("/assignments", createAssignmentHandler);
router.get("/assignments", getAssignmentsHandler);
router.patch("/assignments/:id", updateAssignmentHandler);
router.delete("/assignments/:id", deleteAssignmentHandler);

// Timetable — principal builds a teacher's schedule (from Teacher Allocation)
// or a section's schedule (from Class & Subject Maintenance).
router.post("/timetable/slots", principalUpsertSlotHandler);
router.delete("/timetable/slots/:id", principalDeleteSlotHandler);
router.get("/timetable/section/:sectionId", getSectionTimetableHandler);
router.get("/timetable/teacher/:teacherId", getTeacherTimetableHandler);

// Academic Structure wings (Primary Wing, Secondary Wing, etc.)
router.post("/wings", createWingHandler);
router.get("/wings", getWingsHandler);
router.patch("/wings/:slug", updateWingHandler);
router.delete("/wings/:slug", deleteWingHandler);
router.post("/wings/reorder", reorderWingsHandler);

// School profile.
router.patch("/profile", updateSchool);

export default router;