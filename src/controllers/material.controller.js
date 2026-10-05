import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createMaterialSchema } from "../validations/material.validation.js";
import {
  createMaterial,
  getMyTeacherMaterials,
  getMyStudentMaterials,
  deleteMaterial,
} from "../services/material.service.js";

export const createMaterialHandler = asyncHandler(async (req, res) => {
  const data = createMaterialSchema.parse(req.body);
  const material = await createMaterial(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Material added", { material }, 201);
});

export const getMyTeacherMaterialsHandler = asyncHandler(async (req, res) => {
  const materials = await getMyTeacherMaterials(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Materials retrieved", { materials });
});

export const getMyStudentMaterialsHandler = asyncHandler(async (req, res) => {
  const materials = await getMyStudentMaterials(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Materials retrieved", { materials });
});

export const deleteMaterialHandler = asyncHandler(async (req, res) => {
  const result = await deleteMaterial(req.user.schoolId, req.user._id, req.params.slug);
  return ApiResponse.success(res, result.message);
});
