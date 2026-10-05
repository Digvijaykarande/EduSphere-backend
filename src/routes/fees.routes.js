import { Router } from "express";
import {
  upsertFeeStructureHandler,
  getFeeStructuresHandler,
  bulkAssignFeeHandler,
  assignStudentFeeHandler,
  listSchoolFeesHandler,
  getFeeStatsHandler,
  getStudentFeeDetailHandler,
  recordPaymentHandler,
  getSchoolClassesHandler,
} from "../controllers/fees.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

router.use(protect);

// Read views: SCHOOL/SUPER_ADMIN manage; TEACHER can view the same principal
// dashboard (list, stats, detail, payment history) but cannot create fee
// structures or record payments.
const READ_ROLES = [ROLES.SCHOOL, ROLES.SUPER_ADMIN, ROLES.TEACHER];
const WRITE_ROLES = [ROLES.SCHOOL, ROLES.SUPER_ADMIN];

// Classes present in the school right now (from the live Student roster) —
// powers the Class & Section filter and the Allocate Fees class picker.
router.get("/classes", authorizeRoles(...READ_ROLES), getSchoolClassesHandler);

// Fee structures (templates per class/academic year).
router.post("/structures", authorizeRoles(...WRITE_ROLES), upsertFeeStructureHandler);
router.get("/structures", authorizeRoles(...READ_ROLES), getFeeStructuresHandler);
router.post("/structures/assign-bulk", authorizeRoles(...WRITE_ROLES), bulkAssignFeeHandler);

// Dashboard list + stats (FeesTable / StatCard).
router.get("/students", authorizeRoles(...READ_ROLES), listSchoolFeesHandler);
router.get("/stats", authorizeRoles(...READ_ROLES), getFeeStatsHandler);

// Per-student detail (StudentFeeDetailModal), assignment/override, payments.
router.get("/students/:slug", authorizeRoles(...READ_ROLES), getStudentFeeDetailHandler);
router.post("/students/:slug/assign", authorizeRoles(...WRITE_ROLES), assignStudentFeeHandler);
router.post("/students/:slug/payments", authorizeRoles(...WRITE_ROLES), recordPaymentHandler);

export default router;
