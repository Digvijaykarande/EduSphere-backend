import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createDiaryEntrySchema } from "../validations/studyDiary.validation.js";
import {
  createDiaryEntry,
  getMyDiaryEntries,
  deleteDiaryEntry,
} from "../services/studyDiary.service.js";

export const createDiaryEntryHandler = asyncHandler(async (req, res) => {
  const data = createDiaryEntrySchema.parse(req.body);
  const entry = await createDiaryEntry(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Entry saved", { entry }, 201);
});

export const getMyDiaryEntriesHandler = asyncHandler(async (req, res) => {
  const entries = await getMyDiaryEntries(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Entries retrieved", { entries });
});

export const deleteDiaryEntryHandler = asyncHandler(async (req, res) => {
  const result = await deleteDiaryEntry(req.user.schoolId, req.user._id, req.params.id);
  return ApiResponse.success(res, result.message);
});
