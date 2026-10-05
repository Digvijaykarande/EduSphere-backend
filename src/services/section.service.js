import AppError from "../utils/AppError.js";
import Section from "../models/Section.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import TeacherAssignment from "../models/TeacherAssignment.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

export async function createSection(schoolId, data) {
  const sid = targetSchoolId(schoolId);

  const teacher = await Teacher.findOne({ _id: data.classTeacherId, schoolId: sid });
  if (!teacher) {
    throw new AppError("classTeacherId does not belong to your school", 400);
  }

  const slug = await Section.generateUniqueSectionSlug();

  const section = await Section.create({
    slug,
    schoolId: sid,
    gradeClass: data.gradeClass,
    section: data.section,
    classTeacherId: data.classTeacherId,
    room: data.room || "",
    seatCapacity: data.seatCapacity || 40,
    subjects: data.subjects || [],
  });

  return section;
}

export async function getSchoolSections(schoolId, { search, page = 1, limit = 20 } = {}) {
  const sid = targetSchoolId(schoolId);
  const query = { schoolId: sid };

  if (search) {
    query.$or = [
      { gradeClass: { $regex: search, $options: "i" } },
      { section: { $regex: search, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [sections, total] = await Promise.all([
    Section.find(query)
      .populate("classTeacherId", "firstName lastName employeeId slug")
      .sort({ gradeClass: 1, section: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Section.countDocuments(query),
  ]);

  return {
    sections,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  };
}

export async function getSectionBySlug(schoolId, slug) {
  const sid = targetSchoolId(schoolId);
  const section = await Section.findOne({ slug, schoolId: sid }).populate(
    "classTeacherId",
    "firstName lastName employeeId slug"
  );
  if (!section) throw new AppError("Section not found", 404);
  return section;
}

export async function updateSection(schoolId, slug, patch) {
  const sid = targetSchoolId(schoolId);
  const section = await Section.findOne({ slug, schoolId: sid });
  if (!section) throw new AppError("Section not found", 404);

  if (patch.classTeacherId) {
    const teacher = await Teacher.findOne({ _id: patch.classTeacherId, schoolId: sid });
    if (!teacher) {
      throw new AppError("classTeacherId does not belong to your school", 400);
    }
  }

  Object.assign(section, patch);
  await section.save();
  return section;
}

export async function deleteSection(schoolId, slug) {
  const sid = targetSchoolId(schoolId);
  const section = await Section.findOne({ slug, schoolId: sid });
  if (!section) throw new AppError("Section not found", 404);

  const studentCount = await Student.countDocuments({ sectionId: section._id, status: "ACTIVE" });
  if (studentCount > 0) {
    throw new AppError(
      `Cannot delete: ${studentCount} active student(s) are still linked to this section`,
      400
    );
  }

  section.isActive = false;
  await section.save();

  // Deactivate any teacher assignments pointing at this section too, so
  // stale rows don't silently keep granting mark permissions.
  await TeacherAssignment.updateMany(
    { sectionId: section._id },
    { $set: { isActive: false } }
  );

  return { message: "Section deactivated" };
}
