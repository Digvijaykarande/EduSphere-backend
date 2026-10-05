import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createSectionSchema,
  updateSectionSchema,
} from "../validations/section.validation.js";
import {
  createSection,
  getSchoolSections,
  getSectionBySlug,
  updateSection,
  deleteSection,
} from "../services/section.service.js";

const slugParam = (req) => req.params.slug;

export const createSectionHandler = asyncHandler(async (req, res) => {
  const data = createSectionSchema.parse(req.body);
  const section = await createSection(req.user.schoolId, data);
  return ApiResponse.success(res, "Section created", { section }, 201);
});

export const getSections = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await getSchoolSections(req.user.schoolId, { search, page, limit });
  return ApiResponse.success(res, "Sections retrieved", result);
});

export const getSection = asyncHandler(async (req, res) => {
  const section = await getSectionBySlug(req.user.schoolId, slugParam(req));
  return ApiResponse.success(res, "Section retrieved", { section });
});

export const updateSectionHandler = asyncHandler(async (req, res) => {
  const patch = updateSectionSchema.parse(req.body);
  const section = await updateSection(req.user.schoolId, slugParam(req), patch);
  return ApiResponse.success(res, "Section updated", { section });
});

export const deleteSectionHandler = asyncHandler(async (req, res) => {
  const result = await deleteSection(req.user.schoolId, slugParam(req));
  return ApiResponse.success(res, result.message);
});
