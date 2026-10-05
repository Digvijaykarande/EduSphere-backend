import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import {
  upsertFeeStructureSchema,
  bulkAssignFeeSchema,
  assignStudentFeeSchema,
  recordPaymentSchema,
  listSchoolFeesQuerySchema,
  yearQuerySchema,
} from "../validations/fees.validation.js";
import {
  upsertFeeStructure,
  getFeeStructures,
  bulkAssignFeeToClass,
  assignStudentFeeDirect,
  listSchoolFees,
  getFeeStats,
  getStudentFeeDetail,
  recordPayment,
  getMyFee,
  getMyPayments,
  getCurrentAcademicYear,
  getSchoolClasses,
} from "../services/fees.service.js";

const slugParam = (req) => req.params.slug;

// ---------------------------------------------------------------------------
// Principal / Teacher (school-scoped) — mounted at /api/school/fees
// ---------------------------------------------------------------------------

export const upsertFeeStructureHandler = asyncHandler(async (req, res) => {
  const data = upsertFeeStructureSchema.parse(req.body);
  const structure = await upsertFeeStructure(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Fee structure saved", { structure }, 201);
});

export const getSchoolClassesHandler = asyncHandler(async (req, res) => {
  const result = await getSchoolClasses(req.user.schoolId);
  return ApiResponse.success(res, "Classes retrieved", result);
});

export const getFeeStructuresHandler = asyncHandler(async (req, res) => {
  const { academicYear } = yearQuerySchema.parse(req.query);
  const structures = await getFeeStructures(req.user.schoolId, { academicYear });
  return ApiResponse.success(res, "Fee structures retrieved", { structures });
});

export const bulkAssignFeeHandler = asyncHandler(async (req, res) => {
  const data = bulkAssignFeeSchema.parse(req.body);
  const result = await bulkAssignFeeToClass(req.user.schoolId, data);
  return ApiResponse.success(res, "Fees assigned to class", result);
});

export const assignStudentFeeHandler = asyncHandler(async (req, res) => {
  const data = assignStudentFeeSchema.parse(req.body);
  const fee = await assignStudentFeeDirect(req.user.schoolId, slugParam(req), data);
  return ApiResponse.success(res, "Student fee assigned", { fee }, 201);
});

export const listSchoolFeesHandler = asyncHandler(async (req, res) => {
  const query = listSchoolFeesQuerySchema.parse(req.query);
  const result = await listSchoolFees(req.user.schoolId, {
    academicYear: query.academicYear || getCurrentAcademicYear(),
    gradeClass: query.gradeClass,
    status: query.status,
    feeCategory: query.feeCategory,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
  return ApiResponse.success(res, "Fees retrieved", result);
});

export const getFeeStatsHandler = asyncHandler(async (req, res) => {
  const { academicYear } = yearQuerySchema.parse(req.query);
  const stats = await getFeeStats(req.user.schoolId, academicYear || getCurrentAcademicYear());
  return ApiResponse.success(res, "Fee stats retrieved", { stats });
});

export const getStudentFeeDetailHandler = asyncHandler(async (req, res) => {
  const { academicYear } = yearQuerySchema.parse(req.query);
  const detail = await getStudentFeeDetail(
    req.user.schoolId,
    slugParam(req),
    academicYear || getCurrentAcademicYear()
  );
  return ApiResponse.success(res, "Student fee detail retrieved", { detail });
});

export const recordPaymentHandler = asyncHandler(async (req, res) => {
  const data = recordPaymentSchema.parse(req.body);
  const result = await recordPayment(
    req.user.schoolId,
    req.user._id,
    slugParam(req),
    data,
    req.user.schoolId?.schoolCode
  );
  return ApiResponse.success(res, "Payment recorded", result, 201);
});

// ---------------------------------------------------------------------------
// Student self-service — mounted at /api/student/fees
// ---------------------------------------------------------------------------

function studentIdFromReqUser(req) {
  if (req.user.roleProfileModel !== "Student" || !req.user.roleProfileId) {
    throw new AppError("No student profile linked to this account", 403);
  }
  return req.user.roleProfileId;
}

export const getMyFeeHandler = asyncHandler(async (req, res) => {
  const { academicYear } = yearQuerySchema.parse(req.query);
  const fee = await getMyFee(
    req.user.schoolId,
    studentIdFromReqUser(req),
    academicYear || getCurrentAcademicYear()
  );
  return ApiResponse.success(res, "Fee summary retrieved", { fee });
});

export const getMyPaymentsHandler = asyncHandler(async (req, res) => {
  const payments = await getMyPayments(req.user.schoolId, studentIdFromReqUser(req));
  return ApiResponse.success(res, "Payment history retrieved", { payments });
});
