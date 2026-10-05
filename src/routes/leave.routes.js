import { Router } from "express";
import {
  applyLeaveHandler,
  getMyLeavesHandler,
  getLeaveInboxHandler,
  approveLeaveHandler,
  denyLeaveHandler,
} from "../controllers/leave.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

router.use(protect);

// Apply / self-history — STUDENT and TEACHER only. SCHOOL doesn't apply for
// its own leave; there is no "school leave" concept.
router.post("/", authorizeRoles(ROLES.STUDENT, ROLES.TEACHER), applyLeaveHandler);
router.get("/mine", authorizeRoles(ROLES.STUDENT, ROLES.TEACHER), getMyLeavesHandler);

// Inbox + review — TEACHER reviews student leaves (their own section only,
// enforced in the service), SCHOOL reviews teacher leaves. Scoping is
// resolved inside the service since it depends on classTeacherId lookups
// that a route-level role check alone can't express.
router.get("/inbox", authorizeRoles(ROLES.TEACHER, ROLES.SCHOOL), getLeaveInboxHandler);
router.patch("/:slug/approve", authorizeRoles(ROLES.TEACHER, ROLES.SCHOOL), approveLeaveHandler);
router.patch("/:slug/deny", authorizeRoles(ROLES.TEACHER, ROLES.SCHOOL), denyLeaveHandler);

export default router;
