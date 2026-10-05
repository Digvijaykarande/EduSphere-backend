import { Router } from "express";
import { getMyFeeHandler, getMyPaymentsHandler } from "../controllers/fees.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

// Self-service for a logged-in STUDENT only — mirrors teacher.routes.js's
// "structurally unreachable for other roles" convention.
router.use(protect);
router.use(authorizeRoles(ROLES.STUDENT));

router.get("/me", getMyFeeHandler);
router.get("/me/payments", getMyPaymentsHandler);

export default router;
