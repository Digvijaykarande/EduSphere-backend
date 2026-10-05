import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upsertSyllabusSchema } from "../validations/syllabus.validation.js";
import {
  upsertSyllabusProgress,
  getMyTeacherSyllabus,
  getMyStudentSyllabus,
} from "../services/syllabus.service.js";

export const upsertSyllabusHandler = asyncHandler(async (req, res) => {
  const data = upsertSyllabusSchema.parse(req.body);
  const progress = await upsertSyllabusProgress(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Syllabus progress saved", { progress });
});

export const getMyTeacherSyllabusHandler = asyncHandler(async (req, res) => {
  const syllabus = await getMyTeacherSyllabus(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Syllabus retrieved", { syllabus });
});

export const getMyStudentSyllabusHandler = asyncHandler(async (req, res) => {
  const syllabus = await getMyStudentSyllabus(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Syllabus retrieved", { syllabus });
});
