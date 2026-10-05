import cloudinary from "../config/cloudinary.js";
import AppError from "./AppError.js";

const MAX_IMAGE_DIMENSION = 1280; // px, longest side — trimmed down from 1920 to save storage
const IMAGE_MIME_PREFIX = "image/";
const PDF_MIME = "application/pdf";

/**
 * Decides the Cloudinary resource_type and any compression transformation
 * to apply at upload time, based on the file's mimetype.
 *
 * Storage-priority mode: we apply the transformation as an upload-time
 * `transformation` (not `eager`). `eager` would store the ORIGINAL upload
 * AND the derived version side by side, roughly doubling storage on a free
 * plan. Using `transformation` instead means Cloudinary discards the
 * oversized original and only the compressed asset is ever persisted.
 *
 * - Images: resource_type "image", capped at MAX_IMAGE_DIMENSION on the
 *   longest side (limit crop — never upscales smaller images), quality
 *   pinned low (quality is explicitly deprioritized per current
 *   requirements) and fetch_format:auto so Cloudinary re-encodes into
 *   whichever modern format (WebP/AVIF) is smallest.
 * - PDFs: resource_type "image" (Cloudinary treats PDFs as image assets for
 *   transformation purposes), same low-quality transformation applied
 *   across embedded page content to shrink embedded raster images without
 *   touching vector text/layout.
 * - Everything else (Office docs, plain text, etc.): resource_type "raw",
 *   uploaded as-is — Cloudinary has no meaningful compression path for
 *   these formats, and re-encoding them client-side is out of scope.
 */
const COMPRESSED_IMAGE_QUALITY = "auto:low"; // aggressive — favors small file size over fidelity

function buildUploadOptions(mimetype) {
  if (mimetype.startsWith(IMAGE_MIME_PREFIX)) {
    return {
      resource_type: "image",
      transformation: [
        {
          crop: "limit",
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          quality: COMPRESSED_IMAGE_QUALITY,
          fetch_format: "auto",
        },
      ],
    };
  }

  if (mimetype === PDF_MIME) {
    return {
      resource_type: "image", // Cloudinary requires this for PDF transformations
      transformation: [{ quality: COMPRESSED_IMAGE_QUALITY }],
    };
  }

  return { resource_type: "raw" };
}

/**
 * Uploads a single in-memory file buffer (from multer's memoryStorage) to
 * Cloudinary and returns the metadata shape used by both
 * Assignment.attachments and AssignmentSubmission.attachments.
 *
 * folder scopes uploads per-school so a school's files are browsable/
 * manageable as a group in the Cloudinary dashboard (e.g.
 * "edusphere/<schoolId>/assignments").
 *
 * Because compression is now applied as an upload-time `transformation`
 * (see buildUploadOptions above) rather than `eager`, Cloudinary never
 * stores the oversized original — `result.secure_url` / `result.bytes`
 * already ARE the compressed asset, so there's no separate "originalSize"
 * to report anymore.
 */
export function uploadBufferToCloudinary(buffer, { folder, filename, mimetype }) {
  const options = buildUploadOptions(mimetype);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename ? filename.replace(/\.[^/.]+$/, "") : undefined,
        use_filename: true,
        unique_filename: true,
        ...options,
      },
      (error, result) => {
        if (error) return reject(new AppError(`Upload failed: ${error.message}`, 502));

        resolve({
          name: filename,
          url: result.secure_url,
          size: result.bytes,
          type: mimetype,
        });
      }
    );
    stream.end(buffer);
  });
}