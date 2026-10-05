import AppError from "../utils/AppError.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import Teacher from "../models/Teacher.js";
import Section from "../models/Section.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

async function assertBelongsToSchool(sid, teacherId, sectionId) {
  const [teacher, section] = await Promise.all([
    Teacher.findOne({ _id: teacherId, schoolId: sid }),
    Section.findOne({ _id: sectionId, schoolId: sid, isActive: true }),
  ]);
  if (!teacher) throw new AppError("teacherId does not belong to your school", 400);
  if (!section) throw new AppError("sectionId not found or inactive", 400);
  return { teacher, section };
}

/**
 * Create an assignment, or — if this (teacher, section) pair already has a
 * row — merge in the new subjects rather than erroring. This matches the
 * "click subjects, then add" allocation-modal UX, where a teacher's subject
 * list for a section can grow over multiple submissions.
 */
export async function createOrMergeAssignment(schoolId, data) {
  const sid = targetSchoolId(schoolId);
  await assertBelongsToSchool(sid, data.teacherId, data.sectionId);

  const existing = await TeacherAssignment.findOne({
    teacherId: data.teacherId,
    sectionId: data.sectionId,
  });

  if (existing) {
    const merged = new Set([...existing.subjects, ...data.subjects]);
    existing.subjects = Array.from(merged);
    existing.isActive = true;
    await existing.save();
    return existing;
  }

  return TeacherAssignment.create({
    schoolId: sid,
    teacherId: data.teacherId,
    sectionId: data.sectionId,
    subjects: data.subjects,
  });
}

export async function getAssignments(schoolId, { teacherId, sectionId } = {}) {
  const sid = targetSchoolId(schoolId);
  const query = { schoolId: sid, isActive: true };
  if (teacherId) query.teacherId = teacherId;
  if (sectionId) query.sectionId = sectionId;

  return TeacherAssignment.find(query)
    .populate("teacherId", "firstName lastName employeeId slug")
    .populate("sectionId", "gradeClass section slug")
    .sort({ createdAt: -1 });
}

export async function updateAssignment(schoolId, id, patch) {
  const sid = targetSchoolId(schoolId);
  const assignment = await TeacherAssignment.findOne({ _id: id, schoolId: sid });
  if (!assignment) throw new AppError("Assignment not found", 404);

  Object.assign(assignment, patch);
  await assignment.save();
  return assignment;
}

export async function deleteAssignment(schoolId, id) {
  const sid = targetSchoolId(schoolId);
  const assignment = await TeacherAssignment.findOneAndDelete({ _id: id, schoolId: sid });
  if (!assignment) throw new AppError("Assignment not found", 404);
  return { message: "Assignment removed" };
}

/**
 * Self-service lookup for a logged-in teacher: their own sections + subjects,
 * used to populate the AttendanceToolbar dropdowns so a teacher only ever
 * sees class/section/subject combinations they're actually allowed to mark.
 */
export async function getMyAssignments(schoolId, teacherUserId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  const assignments = await TeacherAssignment.find({
    teacherId: teacher._id,
    schoolId: sid,
    isActive: true,
  }).populate("sectionId", "gradeClass section slug classTeacherId");

  return {
    teacherId: teacher._id,
    assignments,
  };
}

/**
 * Core authorization check reused by the attendance service: does this
 * teacher have an active assignment to teach `subject` for `sectionId`?
 */
export async function assertTeacherCanMark({ teacherId, sectionId, subject }) {
  const assignment = await TeacherAssignment.findOne({
    teacherId,
    sectionId,
    isActive: true,
    subjects: subject,
  });
  if (!assignment) {
    throw new AppError(
      "You are not assigned to teach this subject for this section",
      403
    );
  }
  return assignment;
}
