import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} from "../validations/assignment.validation.js";
import {
  createAssignment,
  getMyCreatedAssignments,
  getMyVisibleAssignments,
  getAssignmentDetail,
  submitAssignment,
  gradeSubmission,
} from "../services/assignment.service.js";

// --- Teacher ---

export const createAssignmentHandler = asyncHandler(async (req, res) => {
  const data = createAssignmentSchema.parse(req.body);
  const assignment = await createAssignment(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Assignment created", { assignment }, 201);
});

export const getMyCreatedAssignmentsHandler = asyncHandler(async (req, res) => {
  const assignments = await getMyCreatedAssignments(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Assignments retrieved", { assignments });
});

export const gradeSubmissionHandler = asyncHandler(async (req, res) => {
  const data = gradeSubmissionSchema.parse(req.body);
  const submission = await gradeSubmission(
    req.user.schoolId,
    req.user._id,
    req.params.slug,
    req.params.studentSlug,
    data
  );
  return ApiResponse.success(res, "Submission graded", { submission });
});

// --- Student ---

export const getMyVisibleAssignmentsHandler = asyncHandler(async (req, res) => {
  const assignments = await getMyVisibleAssignments(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Assignments retrieved", { assignments });
});

export const submitAssignmentHandler = asyncHandler(async (req, res) => {
  const data = submitAssignmentSchema.parse(req.body);
  const submission = await submitAssignment(req.user.schoolId, req.user._id, req.params.slug, data);
  return ApiResponse.success(res, "Assignment submitted", { submission });
});

// --- Shared detail (STUDENT self / TEACHER / SCHOOL) ---

export const getAssignmentDetailHandler = asyncHandler(async (req, res) => {
  const result = await getAssignmentDetail(req.user.schoolId, req.params.slug, req.user);
  return ApiResponse.success(res, "Assignment detail retrieved", result);
});
