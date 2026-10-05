// src/routes/event.routes.js
import express from "express";
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/event.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import AppError from "../utils/AppError.js";

// auth.middleware.js only exports `protect` (no `authorize`), so the
// role check for mutating routes lives here instead.
function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(`Role '${req.user?.role}' is not authorized to access this resource`, 403)
      );
    }
    next();
  };
}

const router = express.Router();

// Every route needs a logged-in user...
router.use(protect);

// ...but GET is open to all roles (student, teacher, principal/SCHOOL).
router.get("/", getEvents);

// Create/edit/delete are restricted to principal (SCHOOL) and teacher.
router.post("/", requireRoles("SCHOOL", "TEACHER"), createEvent);
router
  .route("/:id")
  .patch(requireRoles("SCHOOL", "TEACHER"), updateEvent)
  .delete(requireRoles("SCHOOL", "TEACHER"), deleteEvent);

export default router;