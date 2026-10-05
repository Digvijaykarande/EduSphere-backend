import AppError from "../utils/AppError.js";
import StudyMaterial from "../models/StudyMaterial.js";
import Section from "../models/Section.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import TeacherAssignment from "../models/TeacherAssignment.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

export async function createMaterial(schoolId, teacherUserId, data) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  const section = await Section.findOne({ _id: data.sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  // If a subject was specified, the teacher must be assigned to teach it
  // for this section — same rule as attendance/assignments. If no subject
  // was given (general/cross-subject material), just require SOME active
  // assignment to this section so a teacher can't post to a class they
  // have nothing to do with.
  const hasAnyAssignment = await TeacherAssignment.findOne({
    teacherId: teacher._id,
    sectionId: data.sectionId,
    isActive: true,
    ...(data.subject ? { subjects: data.subject } : {}),
  });
  if (!hasAnyAssignment) {
    throw new AppError("You are not assigned to this section" + (data.subject ? " for this subject" : ""), 403);
  }

  const slug = await StudyMaterial.generateUniqueMaterialSlug();

  return StudyMaterial.create({
    slug,
    schoolId: sid,
    sectionId: data.sectionId,
    subject: data.subject,
    title: data.title,
    type: data.type,
    uploadedBy: teacher._id,
    url: data.url,
    fileSize: data.fileSize,
    duration: data.duration,
  });
}

/** Materials the logged-in teacher has posted, across all their sections. */
export async function getMyTeacherMaterials(schoolId, teacherUserId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  return StudyMaterial.find({ uploadedBy: teacher._id, schoolId: sid, isActive: true })
    .populate("sectionId", "gradeClass section")
    .sort({ createdAt: -1 });
}

/** Materials visible to the logged-in student — everything for their section. */
export async function getMyStudentMaterials(schoolId, studentUserId) {
  const sid = targetSchoolId(schoolId);
  const student = await Student.findOne({ userId: studentUserId, schoolId: sid });
  if (!student) throw new AppError("Student profile not found", 404);
  if (!student.sectionId) {
    throw new AppError("Your section is not yet assigned — contact your school", 400);
  }

  return StudyMaterial.find({ sectionId: student.sectionId, schoolId: sid, isActive: true }).sort({
    createdAt: -1,
  });
}

export async function deleteMaterial(schoolId, teacherUserId, slug) {
  const sid = targetSchoolId(schoolId);
  const teacher = await Teacher.findOne({ userId: teacherUserId, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  const material = await StudyMaterial.findOne({ slug, schoolId: sid });
  if (!material) throw new AppError("Material not found", 404);
  if (String(material.uploadedBy) !== String(teacher._id)) {
    throw new AppError("You may only remove material you uploaded", 403);
  }

  material.isActive = false;
  await material.save();
  return { message: "Material removed" };
}
