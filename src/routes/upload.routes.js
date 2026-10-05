import { Router } from "express";
import { uploadFilesHandler } from "../controllers/upload.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../models/constants.js";

const router = Router();

router.use(protect);

// Both teachers (assignment reference material) and students (submission
// attachments) can upload — purpose is passed as ?purpose=submission to
// route into a different Cloudinary folder, otherwise defaults to
// "assignments".
router.post(
  "/",
  authorizeRoles(ROLES.TEACHER, ROLES.STUDENT, ROLES.SCHOOL, ROLES.SUPER_ADMIN),
  upload.array("files", 5),
  uploadFilesHandler
);

export default router;
