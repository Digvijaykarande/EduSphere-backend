import multer from "multer";
import AppError from "../utils/AppError.js";

const storage = multer.memoryStorage();

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument", "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint", "text/plain"];

function fileFilter(req, file, cb) {
  const allowed = ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p));
  if (!allowed) {
    return cb(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 5,
  },
});
