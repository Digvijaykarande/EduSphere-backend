import AppError from "../utils/AppError.js";
import SyllabusProgress from "../models/SyllabusProgress.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import { assertTeacherCanMark } from "./teacherAssignment.service.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

export async function upsertSyllabusProgress(schoolId, teacherUserId, data) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  await assertTeacherCanMark({ teacherId: teacher._id, sectionId: data.sectionId, subject: data.subject });

  return SyllabusProgress.findOneAndUpdate(
    { sectionId: data.sectionId, subject: data.subject },
    {
      $set: {
        schoolId: sid,
        teacherId: teacher._id,
        progressPercentage: data.progressPercentage,
        currentUnit: data.currentUnit,
        color: data.color,
      },
    },
    { upsert: true, new: true }
  );
}

/** All syllabus rows across every section the logged-in teacher teaches. */
export async function getMyTeacherSyllabus(schoolId, teacherUserId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  return SyllabusProgress.find({ teacherId: teacher._id, schoolId: sid })
    .populate("sectionId", "gradeClass section")
    .sort({ subject: 1 });
}

/** Syllabus rows for the logged-in student's own section. */
export async function getMyStudentSyllabus(schoolId, studentUserId) {
  const sid = targetSchoolId(schoolId);
  const student = await Student.findOne({ userId: studentUserId, schoolId: sid });
  if (!student) throw new AppError("Student profile not found", 404);
  if (!student.sectionId) {
    throw new AppError("Your section is not yet assigned — contact your school", 400);
  }

  return SyllabusProgress.find({ sectionId: student.sectionId, schoolId: sid }).sort({ subject: 1 });
}
