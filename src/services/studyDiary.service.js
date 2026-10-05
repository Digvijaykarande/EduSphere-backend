import AppError from "../utils/AppError.js";
import StudyDiaryEntry from "../models/StudyDiaryEntry.js";
import Student from "../models/Student.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

async function resolveStudent(schoolId, userId) {
  const student = await Student.findOne({ userId, schoolId });
  if (!student) throw new AppError("Student profile not found", 404);
  return student;
}

export async function createDiaryEntry(schoolId, studentUserId, data) {
  const sid = targetSchoolId(schoolId);
  const student = await resolveStudent(sid, studentUserId);

  return StudyDiaryEntry.create({
    schoolId: sid,
    studentId: student._id,
    content: data.content,
    duration: data.duration,
    tags: data.tags,
  });
}

export async function getMyDiaryEntries(schoolId, studentUserId) {
  const sid = targetSchoolId(schoolId);
  const student = await resolveStudent(sid, studentUserId);

  return StudyDiaryEntry.find({ studentId: student._id, schoolId: sid }).sort({ createdAt: -1 });
}

export async function deleteDiaryEntry(schoolId, studentUserId, entryId) {
  const sid = targetSchoolId(schoolId);
  const student = await resolveStudent(sid, studentUserId);

  const entry = await StudyDiaryEntry.findOneAndDelete({ _id: entryId, studentId: student._id, schoolId: sid });
  if (!entry) throw new AppError("Entry not found", 404);
  return { message: "Entry removed" };
}
