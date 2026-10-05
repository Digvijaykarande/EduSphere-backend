import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createTimetableSlotSchema,
  principalCreateTimetableSlotSchema,
} from "../validations/timetable.validation.js";
import {
  upsertSlot,
  deleteSlot,
  getMyTeacherSchedule,
  getMyStudentTimetable,
  principalUpsertSlot,
  principalDeleteSlot,
  getSectionTimetable,
  getTeacherTimetableAdmin,
} from "../services/timetable.service.js";

export const upsertSlotHandler = asyncHandler(async (req, res) => {
  const data = createTimetableSlotSchema.parse(req.body);
  const slot = await upsertSlot(req.user.schoolId, req.user._id, data);
  return ApiResponse.success(res, "Slot saved", { slot });
});

export const deleteSlotHandler = asyncHandler(async (req, res) => {
  const result = await deleteSlot(req.user.schoolId, req.user._id, req.params.id);
  return ApiResponse.success(res, result.message);
});

export const getMyTeacherScheduleHandler = asyncHandler(async (req, res) => {
  const schedule = await getMyTeacherSchedule(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Schedule retrieved", schedule);
});

export const getMyStudentTimetableHandler = asyncHandler(async (req, res) => {
  const timetable = await getMyStudentTimetable(req.user.schoolId, req.user._id);
  return ApiResponse.success(res, "Timetable retrieved", timetable);
});

// Principal/school — build timetables from Teacher Allocation / Class & Subject Maintenance.
export const principalUpsertSlotHandler = asyncHandler(async (req, res) => {
  const data = principalCreateTimetableSlotSchema.parse(req.body);
  const slot = await principalUpsertSlot(req.user.schoolId, data);
  return ApiResponse.success(res, "Slot saved", { slot });
});

export const principalDeleteSlotHandler = asyncHandler(async (req, res) => {
  const result = await principalDeleteSlot(req.user.schoolId, req.params.id);
  return ApiResponse.success(res, result.message);
});

export const getSectionTimetableHandler = asyncHandler(async (req, res) => {
  const timetable = await getSectionTimetable(req.user.schoolId, req.params.sectionId);
  return ApiResponse.success(res, "Timetable retrieved", timetable);
});

export const getTeacherTimetableHandler = asyncHandler(async (req, res) => {
  const schedule = await getTeacherTimetableAdmin(req.user.schoolId, req.params.teacherId);
  return ApiResponse.success(res, "Schedule retrieved", schedule);
});
