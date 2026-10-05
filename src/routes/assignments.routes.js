import { Router } from "express";
import { getAssignmentDetailHandler } from "../controllers/assignment.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

router.use(protect);

// Self-only enforcement for STUDENT happens inside the service (compares
// the assignment's sectionId against the caller's own Student.sectionId).
router.get(
  "/:slug",
  authorizeRoles(ROLES.STUDENT, ROLES.TEACHER, ROLES.SCHOOL),
  getAssignmentDetailHandler
);

export default router;
