import AppError from "../utils/AppError.js";
import TimetableSlot, { TIMETABLE_DAYS } from "../models/TimetableSlot.js";
import Section from "../models/Section.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import { assertTeacherCanMark } from "./teacherAssignment.service.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

async function resolveTeacher(schoolId, userId) {
  const teacher = await Teacher.findOne({ userId, schoolId });
  if (!teacher) throw new AppError("Teacher profile not found", 404);
  return teacher;
}

/**
 * Create/replace a timetable slot for (section, day, period). Upserts —
 * re-saving the same cell overwrites rather than erroring, matching how a
 * timetable grid is naturally edited (click a cell, fill it in, save).
 */
export async function upsertSlot(schoolId, teacherUserId, data) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const section = await Section.findOne({ _id: data.sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  await assertTeacherCanMark({ teacherId: teacher._id, sectionId: data.sectionId, subject: data.subject });

  // Prevent double-booking this teacher into two sections at the same
  // day+period — a cross-document check the schema's unique index can't
  // express (that index only guards per-section, per-cell uniqueness).
  const conflict = await TimetableSlot.findOne({
    teacherId: teacher._id,
    day: data.day,
    period: data.period,
    sectionId: { $ne: data.sectionId },
  });
  if (conflict) {
    throw new AppError("You are already scheduled elsewhere at this day/period", 409);
  }

  const slot = await TimetableSlot.findOneAndUpdate(
    { sectionId: data.sectionId, day: data.day, period: data.period },
    {
      $set: {
        schoolId: sid,
        startMinutes: data.startMinutes,
        durationMinutes: data.durationMinutes,
        subject: data.subject,
        teacherId: teacher._id,
        room: data.room,
        type: data.type,
        topic: data.topic,
      },
    },
    { upsert: true, new: true }
  );

  return slot;
}

/**
 * Principal/school variant of upsertSlot — teacher is chosen directly by
 * Teacher._id (from Teacher Allocation) rather than resolved from the
 * logged-in user, since the caller here is the principal, not the teacher.
 */
export async function principalUpsertSlot(schoolId, data) {
  const sid = targetSchoolId(schoolId);

  const section = await Section.findOne({ _id: data.sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  const teacher = await Teacher.findOne({ _id: data.teacherId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher not found", 404);

  await assertTeacherCanMark({ teacherId: teacher._id, sectionId: data.sectionId, subject: data.subject });

  const conflict = await TimetableSlot.findOne({
    teacherId: teacher._id,
    day: data.day,
    period: data.period,
    sectionId: { $ne: data.sectionId },
  });
  if (conflict) {
    throw new AppError("This teacher is already scheduled elsewhere at this day/period", 409);
  }

  const slot = await TimetableSlot.findOneAndUpdate(
    { sectionId: data.sectionId, day: data.day, period: data.period },
    {
      $set: {
        schoolId: sid,
        startMinutes: data.startMinutes,
        durationMinutes: data.durationMinutes,
        subject: data.subject,
        teacherId: teacher._id,
        room: data.room,
        type: data.type,
        topic: data.topic,
      },
    },
    { upsert: true, new: true }
  );

  return slot;
}

export async function principalDeleteSlot(schoolId, slotId) {
  const sid = targetSchoolId(schoolId);
  const slot = await TimetableSlot.findOne({ _id: slotId, schoolId: sid });
  if (!slot) throw new AppError("Slot not found", 404);
  await slot.deleteOne();
  return { message: "Slot removed" };
}

/**
 * A section's full week, for the principal to review what's been built
 * from Class & Subject Maintenance — same shape as the student view.
 */
export async function getSectionTimetable(schoolId, sectionId) {
  const sid = targetSchoolId(schoolId);
  const section = await Section.findOne({ _id: sectionId, schoolId: sid });
  if (!section) throw new AppError("Section not found", 404);

  const slots = await TimetableSlot.find({ sectionId, schoolId: sid })
    .populate("teacherId", "firstName lastName")
    .sort({ startMinutes: 1 });

  return shapeSchedule(slots, { includeTeacherName: true });
}

/**
 * A specific teacher's full week, for the principal to review what's been
 * built from Teacher Allocation — same shape as that teacher's own view.
 */
export async function getTeacherTimetableAdmin(schoolId, teacherId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ _id: teacherId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher not found", 404);

  const slots = await TimetableSlot.find({ teacherId, schoolId: sid })
    .populate("sectionId", "gradeClass section")
    .sort({ startMinutes: 1 });

  return shapeSchedule(slots, { includeClassBadge: true });
}

export async function deleteSlot(schoolId, teacherUserId, slotId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const slot = await TimetableSlot.findOne({ _id: slotId, schoolId: sid });
  if (!slot) throw new AppError("Slot not found", 404);
  if (String(slot.teacherId) !== String(teacher._id)) {
    throw new AppError("You may only remove your own scheduled slots", 403);
  }

  await slot.deleteOne();
  return { message: "Slot removed" };
}

/**
 * A teacher's own full week, across every section they teach — reshaped
 * into { days, periods: [{ id, time, [day]: slot }] } for the WeekGrid UI,
 * plus a flat "today" list for the DayTimeline view.
 */
export async function getMyTeacherSchedule(schoolId, teacherUserId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const slots = await TimetableSlot.find({ teacherId: teacher._id, schoolId: sid })
    .populate("sectionId", "gradeClass section")
    .sort({ startMinutes: 1 });

  return shapeSchedule(slots, { includeClassBadge: true });
}

/**
 * A student's own section's full week — same shape as the teacher view but
 * scoped to their single section, with teacher names attached per slot.
 */
export async function getMyStudentTimetable(schoolId, studentUserId) {
  const sid = targetSchoolId(schoolId);
  const student = await Student.findOne({ userId: studentUserId, schoolId: sid });
  if (!student) throw new AppError("Student profile not found", 404);
  if (!student.sectionId) {
    throw new AppError("Your section is not yet assigned — contact your school", 400);
  }

  const slots = await TimetableSlot.find({ sectionId: student.sectionId, schoolId: sid })
    .populate("teacherId", "firstName lastName")
    .sort({ startMinutes: 1 });

  return shapeSchedule(slots, { includeTeacherName: true });
}

function shapeSchedule(slots, { includeClassBadge = false, includeTeacherName = false } = {}) {
  const byPeriod = new Map();
  for (const slot of slots) {
    if (!byPeriod.has(slot.period)) {
      byPeriod.set(slot.period, { id: slot.period, time: slot.period });
    }
    const row = byPeriod.get(slot.period);
    row[slot.day] = {
      id: slot._id,
      subject: slot.subject,
      room: slot.room,
      type: slot.type,
      topic: slot.topic,
      sectionId: slot.sectionId?._id || slot.sectionId,
      teacherId: slot.teacherId?._id || slot.teacherId,
      classBadge: includeClassBadge && slot.sectionId ? `${slot.sectionId.gradeClass}-${slot.sectionId.section}` : undefined,
      teacher: includeTeacherName && slot.teacherId ? `${slot.teacherId.firstName} ${slot.teacherId.lastName}` : undefined,
    };
  }

  const periods = Array.from(byPeriod.values()).sort((a, b) => {
    const sa = slots.find((s) => s.period === a.id)?.startMinutes ?? 0;
    const sb = slots.find((s) => s.period === b.id)?.startMinutes ?? 0;
    return sa - sb;
  });

  // Flat "today" list, in start-time order, for a simple day-view timeline.
  const todayAbbrev = TIMETABLE_DAYS[(new Date().getDay() + 6) % 7]; // Sun=0 -> Sat index
  const today = slots
    .filter((s) => s.day === todayAbbrev)
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((s) => ({
      id: s._id,
      time: minutesToLabel(s.startMinutes),
      durationMinutes: s.durationMinutes,
      title: s.subject,
      topic: s.topic,
      type: s.type,
      room: s.room,
      classBadge: includeClassBadge && s.sectionId ? `${s.sectionId.gradeClass}-${s.sectionId.section}` : undefined,
      teacher: includeTeacherName && s.teacherId ? `${s.teacherId.firstName} ${s.teacherId.lastName}` : undefined,
    }));

  return {
    today,
    week: { days: TIMETABLE_DAYS, periods },
  };
}

function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}
