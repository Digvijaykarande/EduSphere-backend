import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

/**
 * Generic authenticated file-upload endpoint. Accepts up to 5 files under
 * the "files" field, uploads each to Cloudinary under
 * edusphere/<schoolId>/<purpose>, and returns attachment metadata
 * ({name, url, size, type}) the client then includes in a subsequent
 * createAssignment / submitAssignment call. Kept generic (not tied to
 * assignments specifically) so it can be reused for other upload needs.
 */

export const uploadFilesHandler = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError("No files provided", 400);
  }

  const PURPOSE_FOLDERS = {
    submission: "submissions",
    logo: "logos",
  };

  const purpose = PURPOSE_FOLDERS[req.query.purpose] || "assignments";

  if (req.query.purpose === "logo") {
    if (req.files.length > 1) {
      throw new AppError("Only one logo file can be uploaded at a time", 400);
    }
    if (!req.files[0].mimetype.startsWith("image/")) {
      throw new AppError("Logo must be an image file", 400);
    }
  }

  const schoolId =
    req.user.schoolId?._id?.toString() || req.user.schoolId?.toString();

  if (!schoolId) {
    throw new AppError("School ID not found for authenticated user", 400);
  }

  const folder = `edusphere/${schoolId}/${purpose}`;

  const attachments = await Promise.all(
    req.files.map((file) =>
      uploadBufferToCloudinary(file.buffer, {
        folder,
        filename: file.originalname,
        mimetype: file.mimetype,
      }),
    ),
  );

  return ApiResponse.success(res, "Files uploaded", { attachments }, 201);
});
