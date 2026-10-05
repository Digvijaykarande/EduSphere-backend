import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import {
  rosterQuerySchema,
  markAttendanceSchema,
  studentHistoryQuerySchema,
  sectionSummaryQuerySchema,
  schoolTrendQuerySchema,
} from "../validations/attendance.validation.js";
import {
  getRosterForSlot,
  markAttendance,
  getStudentHistory,
  getSectionDaySummary,
  getSchoolTrend,
  getSchoolStats,
  getMyAttendanceHistory,
  getMyTodaySummaries,
  getSchoolSections,
  getSectionRoster,
} from "../services/attendance.service.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import { ROLES } from "../models/constants.js";

// A TEACHER may only view section-level data (summary, roster) for sections
// they actually have an active TeacherAssignment on. Throws 403 rather than
// silently filtering, matching the pattern used by assertTeacherCanMark.
async function assertTeacherOwnsSection(schoolId, teacherUserId, sectionId) {
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  const assignment = await TeacherAssignment.findOne({
    teacherId: teacher._id,
    sectionId,
    isActive: true,
  });
  if (!assignment) {
    throw new AppError("You are not assigned to this section", 403);
  }
}

// --- Teacher: mark/roster (mounted under /api/teacher, TEACHER-only route guard) ---

export const getRosterHandler = asyncHandler(async (req, res) => {
  const query = rosterQuerySchema.parse(req.query);
  const result = await getRosterForSlot(req.user.schoolId, req.user._id, query);
  return ApiResponse.success(res, "Roster retrieved", result);
});

export const markAttendanceHandler = asyncHandler(async (req, res) => {
  const data = markAttendanceSchema.parse(req.body);
  const result = await markAttendance(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Attendance saved", result);
});

// --- Shared: student history (STUDENT self, TEACHER, SCHOOL) ---

export const getStudentHistoryHandler = asyncHandler(async (req, res) => {
  const query = studentHistoryQuerySchema.parse(req.query);
  const { slug } = req.params;

  if (req.user.role === ROLES.STUDENT) {
    // A student may only ever view their own attendance — resolve their own
    // Student profile and refuse if the requested slug isn't theirs.
    const own = await Student.findOne({ userId: req.user._id, schoolId: req.user.schoolId });
    if (!own || own.slug !== slug) {
      throw new AppError("You may only view your own attendance", 403);
    }
  }

  const result = await getStudentHistory(req.user.schoolId, slug, query);
  return ApiResponse.success(res, "Attendance history retrieved", result);
});

// --- Shared: section-day summary (TEACHER, SCHOOL) ---

export const getSectionSummaryHandler = asyncHandler(async (req, res) => {
  const query = sectionSummaryQuerySchema.parse(req.query);

  // SCHOOL can view any section; TEACHER only their own assigned sections.
  if (req.user.role === ROLES.TEACHER) {
    await assertTeacherOwnsSection(req.user.schoolId, req.user._id, query.sectionId);
  }

  const result = await getSectionDaySummary(req.user.schoolId, query);
  return ApiResponse.success(res, "Section summary retrieved", result);
});

// --- SCHOOL: browse all sections; SCHOOL + TEACHER (own sections): roster ---

export const getSchoolSectionsHandler = asyncHandler(async (req, res) => {
  const sections = await getSchoolSections(req.user.schoolId);
  return ApiResponse.success(res, "Sections retrieved", { sections });
});

export const getSectionRosterHandler = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  if (req.user.role === ROLES.TEACHER) {
    await assertTeacherOwnsSection(req.user.schoolId, req.user._id, sectionId);
  }

  const result = await getSectionRoster(req.user.schoolId, sectionId);
  return ApiResponse.success(res, "Section roster retrieved", result);
});

// --- SCHOOL only: school-wide trend ---

export const getSchoolTrendHandler = asyncHandler(async (req, res) => {
  const query = schoolTrendQuerySchema.parse(req.query);
  const result = await getSchoolTrend(req.user.schoolId, query);
  return ApiResponse.success(res, "School trend retrieved", { trend: result });
});

export const getSchoolStatsHandler = asyncHandler(async (req, res) => {
  const result = await getSchoolStats(req.user.schoolId);
  return ApiResponse.success(res, "School stats retrieved", result);
});

// Self-service — STUDENT viewing their own attendance without needing to
// know their own Student.slug up front.
export const getMyAttendanceHandler = asyncHandler(async (req, res) => {
  const query = studentHistoryQuerySchema.parse(req.query);
  const result = await getMyAttendanceHistory(req.user.schoolId, req.user._id, query);
  return ApiResponse.success(res, "Your attendance retrieved", result);
});

// Self-service — TEACHER's today's attendance summary across all their sections.
export const getMyTodaySummariesHandler = asyncHandler(async (req, res) => {
  const summaries = await getMyTodaySummaries(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Today's summaries retrieved", { summaries });
});