import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from "../validations/section.validation.js";
import {
  createOrMergeAssignment,
  getAssignments,
  updateAssignment,
  deleteAssignment,
  getMyAssignments,
} from "../services/teacherAssignment.service.js";

export const createAssignmentHandler = asyncHandler(async (req, res) => {
  const data = createAssignmentSchema.parse(req.body);
  const assignment = await createOrMergeAssignment(req.user.schoolId, data);
  return ApiResponse.success(res, "Assignment saved", { assignment }, 201);
});

export const getAssignmentsHandler = asyncHandler(async (req, res) => {
  const { teacherId, sectionId } = req.query;
  const assignments = await getAssignments(req.user.schoolId, { teacherId, sectionId });
  return ApiResponse.success(res, "Assignments retrieved", { assignments });
});

export const updateAssignmentHandler = asyncHandler(async (req, res) => {
  const patch = updateAssignmentSchema.parse(req.body);
  const assignment = await updateAssignment(req.user.schoolId, req.params.id, patch);
  return ApiResponse.success(res, "Assignment updated", { assignment });
});

export const deleteAssignmentHandler = asyncHandler(async (req, res) => {
  const result = await deleteAssignment(req.user.schoolId, req.params.id);
  return ApiResponse.success(res, result.message);
});

// Self-service — a logged-in teacher fetching their own sections/subjects.
export const getMyAssignmentsHandler = asyncHandler(async (req, res) => {
  const result = await getMyAssignments(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Your assignments retrieved", result);
});
