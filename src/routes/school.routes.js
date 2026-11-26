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

// All school-management routes require authentication; role checks are per-route
// so teachers can enroll/list students while principal-only routes stay locked.
router.use(protect);

const principalOnly = authorizeRoles(ROLES.SCHOOL, ROLES.SUPER_ADMIN);
const principalOrTeacher = authorizeRoles(
  ROLES.SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.TEACHER
);

// Teacher management — identified by slug, not _id.
router.post("/teachers", principalOnly, createTeacher);
router.get("/teachers", principalOnly, getTeachers);
router.patch("/teachers/:slug", principalOnly, updateTeacher);
router.delete("/teachers/:slug", principalOnly, deleteTeacher);

// Student management — teachers may enroll & list students in their school;
// edits/deletes remain principal-only.
router.post("/students", principalOrTeacher, createStudent);
router.get("/students", principalOrTeacher, getStudents);
router.patch("/students/:slug", principalOnly, updateStudent);
router.delete("/students/:slug", principalOnly, deleteStudent);

// Staff management (Lab Assistant, Librarian, Cashier, etc.) — symmetric.
router.post("/staff", principalOnly, createStaff);
router.get("/staff", principalOnly, getStaff);
router.patch("/staff/:slug", principalOnly, updateStaff);
router.delete("/staff/:slug", principalOnly, deleteStaff);

// Sections (Class 10 - Section A, etc.) — identified by slug.
router.post("/sections", principalOnly, createSectionHandler);
router.get("/sections", principalOnly, getSections);
router.get("/sections/:slug", principalOnly, getSection);
router.patch("/sections/:slug", principalOnly, updateSectionHandler);
router.delete("/sections/:slug", principalOnly, deleteSectionHandler);

// Teacher-to-class-subject allocation — the "Allocate Teacher to Class" form.
// Identified by Mongo _id since these rows are never surfaced by slug in the UI.
router.post("/assignments", principalOnly, createAssignmentHandler);
router.get("/assignments", principalOnly, getAssignmentsHandler);
router.patch("/assignments/:id", principalOnly, updateAssignmentHandler);
router.delete("/assignments/:id", principalOnly, deleteAssignmentHandler);

// Timetable — principal builds a teacher's schedule (from Teacher Allocation)
// or a section's schedule (from Class & Subject Maintenance).
router.post("/timetable/slots", principalOnly, principalUpsertSlotHandler);
router.delete("/timetable/slots/:id", principalOnly, principalDeleteSlotHandler);
router.get("/timetable/section/:sectionId", principalOnly, getSectionTimetableHandler);
router.get("/timetable/teacher/:teacherId", principalOnly, getTeacherTimetableHandler);

// Academic Structure wings (Primary Wing, Secondary Wing, etc.)
router.post("/wings", principalOnly, createWingHandler);
router.get("/wings", principalOnly, getWingsHandler);
router.patch("/wings/:slug", principalOnly, updateWingHandler);
router.delete("/wings/:slug", principalOnly, deleteWingHandler);
router.post("/wings/reorder", principalOnly, reorderWingsHandler);

// School profile.
router.patch("/profile", principalOnly, updateSchool);

export default router;