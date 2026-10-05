import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createTeacherSchema,
  createStudentSchema,
  createStaffSchema,
  updateTeacherSchema,
  updateStudentSchema,
  updateStaffSchema,
  updateSchoolProfileSchema,
} from "../validations/school.validation.js";
import {
  createTeacherAccount,
  createStudentAccount,
  createStaffAccount,
  getSchoolTeachers,
  getSchoolStudents,
  getSchoolStaff,
  removeTeacherAccount,
  removeStudentAccount,
  removeStaffAccount,
  updateTeacherAccount,
  updateStudentAccount,
  updateStaffAccount,
  updateSchoolProfile,
} from "../services/school.service.js";

const slugParam = (req) => req.params.slug;

export const createTeacher = asyncHandler(async (req, res) => {
  const data = createTeacherSchema.parse(req.body);
  const result = await createTeacherAccount(req.user.schoolId, data);
  return ApiResponse.success(
    res,
    "Teacher invited. Verification email sent to contact email.",
    result,
    201
  );
});

export const getTeachers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await getSchoolTeachers(req.user.schoolId, {
    search,
    page,
    limit,
  });
  return ApiResponse.success(res, "Teachers retrieved", result);
});

export const updateTeacher = asyncHandler(async (req, res) => {
  const patch = updateTeacherSchema.parse(req.body);
  const teacher = await updateTeacherAccount(
    req.user.schoolId,
    slugParam(req),
    patch
  );
  return ApiResponse.success(res, "Teacher updated", { teacher });
});

export const deleteTeacher = asyncHandler(async (req, res) => {
  const result = await removeTeacherAccount(
    req.user.schoolId,
    slugParam(req)
  );
  return ApiResponse.success(res, result.message);
});

export const createStudent = asyncHandler(async (req, res) => {
  const data = createStudentSchema.parse(req.body);
  const result = await createStudentAccount(req.user.schoolId, data);
  return ApiResponse.success(
    res,
    "Student invited. Verification email sent to contact (parent) email.",
    result,
    201
  );
});

export const getStudents = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await getSchoolStudents(req.user.schoolId, {
    search,
    page,
    limit,
  });
  return ApiResponse.success(res, "Students retrieved", result);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const patch = updateStudentSchema.parse(req.body);
  const student = await updateStudentAccount(
    req.user.schoolId,
    slugParam(req),
    patch
  );
  return ApiResponse.success(res, "Student updated", { student });
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const result = await removeStudentAccount(
    req.user.schoolId,
    slugParam(req)
  );
  return ApiResponse.success(res, result.message);
});

export const createStaff = asyncHandler(async (req, res) => {
  const data = createStaffSchema.parse(req.body);
  const result = await createStaffAccount(req.user.schoolId, data);
  return ApiResponse.success(
    res,
    "Staff invited. Verification email sent to contact email.",
    result,
    201
  );
});

export const getStaff = asyncHandler(async (req, res) => {
  const { search, page, limit, staffType } = req.query;
  const result = await getSchoolStaff(req.user.schoolId, {
    search,
    page,
    limit,
    staffType,
  });
  return ApiResponse.success(res, "Staff retrieved", result);
});

export const updateStaff = asyncHandler(async (req, res) => {
  const patch = updateStaffSchema.parse(req.body);
  const staff = await updateStaffAccount(
    req.user.schoolId,
    slugParam(req),
    patch
  );
  return ApiResponse.success(res, "Staff updated", { staff });
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const result = await removeStaffAccount(req.user.schoolId, slugParam(req));
  return ApiResponse.success(res, result.message);
});

export const updateSchool = asyncHandler(async (req, res) => {
  const patch = updateSchoolProfileSchema.parse(req.body);
  const school = await updateSchoolProfile(req.user.schoolId, patch);
  return ApiResponse.success(res, "School profile updated", { school });
});