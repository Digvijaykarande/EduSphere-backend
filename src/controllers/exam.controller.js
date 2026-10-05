import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createExamSchema,
  updateExamSchema,
  examQuerySchema,
  bulkMarksEntrySchema,
  gradebookQuerySchema,
} from "../validations/exam.validation.js";
import * as examService from "../services/exam.service.js";

const idParam = (req) => req.params.id; // accepts either slug or ObjectId

function isTeacher(req) {
  return req.user.role === "TEACHER";
}

function actorFrom(req) {
  return { userId: req.user._id, isTeacherActor: isTeacher(req) };
}

export const createExamHandler = asyncHandler(async (req, res) => {
  const data = createExamSchema.parse(req.body);
  const exam = await examService.createExam(
    req.user.schoolId,
    req.user._id,
    isTeacher(req),
    data
  );
  return ApiResponse.success(res, "Exam created", { exam }, 201);
});

export const getExamsHandler = asyncHandler(async (req, res) => {
  const query = examQuerySchema.parse(req.query);
  const result = await examService.getExams(req.user.schoolId, query);
  return ApiResponse.success(res, "Exams retrieved", result);
});

export const getExamHandler = asyncHandler(async (req, res) => {
  const exam = await examService.getExamBySlug(req.user.schoolId, idParam(req));
  return ApiResponse.success(res, "Exam retrieved", { exam });
});

export const updateExamHandler = asyncHandler(async (req, res) => {
  const patch = updateExamSchema.parse(req.body);
  const exam = await examService.updateExam(
    req.user.schoolId,
    idParam(req),
    actorFrom(req),
    patch
  );
  return ApiResponse.success(res, "Exam updated", { exam });
});

export const deleteExamHandler = asyncHandler(async (req, res) => {
  const result = await examService.deleteExam(req.user.schoolId, idParam(req), actorFrom(req));
  return ApiResponse.success(res, result.message);
});

// ---------------------------------------------------------------------------
// Gradebook / marks entry
// ---------------------------------------------------------------------------

export const getGradebookHandler = asyncHandler(async (req, res) => {
  const query = gradebookQuerySchema.parse(req.query);
  const result = await examService.getGradebook(
    req.user.schoolId,
    idParam(req),
    actorFrom(req),
    query
  );
  return ApiResponse.success(res, "Gradebook retrieved", result);
});

export const saveMarksHandler = asyncHandler(async (req, res) => {
  const { entries } = bulkMarksEntrySchema.parse(req.body);
  const result = await examService.saveMarks(
    req.user.schoolId,
    idParam(req),
    actorFrom(req),
    entries
  );
  return ApiResponse.success(res, "Marks saved", result);
});

// ---------------------------------------------------------------------------
// Results pipeline
// ---------------------------------------------------------------------------

export const getResultsQueueHandler = asyncHandler(async (req, res) => {
  const queue = await examService.getResultsQueue(req.user.schoolId);
  return ApiResponse.success(res, "Results queue retrieved", { queue });
});

export const publishResultsHandler = asyncHandler(async (req, res) => {
  const exam = await examService.publishResults(req.user.schoolId, idParam(req), actorFrom(req));
  return ApiResponse.success(res, "Results published", { exam });
});

// ---------------------------------------------------------------------------
// Overview / stats / analytics
// ---------------------------------------------------------------------------

export const getStatsHandler = asyncHandler(async (req, res) => {
  const stats = await examService.getExamStats(req.user.schoolId);
  return ApiResponse.success(res, "Stats retrieved", { stats });
});

export const getUpcomingHandler = asyncHandler(async (req, res) => {
  const upcomingExams = await examService.getUpcomingExams(req.user.schoolId);
  return ApiResponse.success(res, "Upcoming exams retrieved", { upcomingExams });
});

export const getRecentResultsHandler = asyncHandler(async (req, res) => {
  const recentResults = await examService.getRecentResults(req.user.schoolId);
  return ApiResponse.success(res, "Recent results retrieved", { recentResults });
});

export const getTopPerformersHandler = asyncHandler(async (req, res) => {
  const topPerformers = await examService.getTopPerformers(req.user.schoolId);
  return ApiResponse.success(res, "Top performers retrieved", { topPerformers });
});

export const getAnalyticsHandler = asyncHandler(async (req, res) => {
  const analytics = await examService.getAnalytics(req.user.schoolId);
  return ApiResponse.success(res, "Analytics retrieved", { analytics });
});

export const getAtRiskStudentsHandler = asyncHandler(async (req, res) => {
  const atRiskStudents = await examService.getAtRiskStudents(req.user.schoolId);
  return ApiResponse.success(res, "At-risk students retrieved", { atRiskStudents });
});

// ---------------------------------------------------------------------------
// Student-facing
// ---------------------------------------------------------------------------

export const getStudentOverviewHandler = asyncHandler(async (req, res) => {
  const overview = await examService.getStudentExamOverview(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Exam overview retrieved", overview);
});
