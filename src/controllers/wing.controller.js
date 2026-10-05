import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createWingSchema,
  updateWingSchema,
  reorderWingsSchema,
} from "../validations/wing.validation.js";
import {
  createWing,
  getSchoolWings,
  updateWing,
  deleteWing,
  reorderWings,
} from "../services/wing.service.js";

export const createWingHandler = asyncHandler(async (req, res) => {
  const data = createWingSchema.parse(req.body);
  const wing = await createWing(req.user.schoolId, data);
  return ApiResponse.success(res, "Wing created", { wing }, 201);
});

export const getWingsHandler = asyncHandler(async (req, res) => {
  const wings = await getSchoolWings(req.user.schoolId);
  return ApiResponse.success(res, "Wings retrieved", { wings });
});

export const updateWingHandler = asyncHandler(async (req, res) => {
  const patch = updateWingSchema.parse(req.body);
  const wing = await updateWing(req.user.schoolId, req.params.slug, patch);
  return ApiResponse.success(res, "Wing updated", { wing });
});

export const deleteWingHandler = asyncHandler(async (req, res) => {
  const result = await deleteWing(req.user.schoolId, req.params.slug);
  return ApiResponse.success(res, result.message);
});

export const reorderWingsHandler = asyncHandler(async (req, res) => {
  const { orderedIds } = reorderWingsSchema.parse(req.body);
  const wings = await reorderWings(req.user.schoolId, orderedIds);
  return ApiResponse.success(res, "Wing order updated", { wings });
});
