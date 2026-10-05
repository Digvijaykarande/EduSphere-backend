import AppError from "../utils/AppError.js";
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { assertTeacherCanMark } from "./teacherAssignment.service.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

async function resolveTeacher(schoolId, userId) {
  const teacher = await Teacher.findOne({ userId, schoolId });
  if (!teacher) throw new AppError("Teacher profile not found", 404);
  return teacher;
}

async function resolveStudent(schoolId, userId) {
  const student = await Student.findOne({ userId, schoolId });
  if (!student) throw new AppError("Student profile not found", 404);
  return student;
}

/**
 * Create an assignment. Reuses the exact same authorization check as
 * attendance marking — a teacher may only create an assignment for a
 * (section, subject) pair they hold an active TeacherAssignment for.
 */
export async function createAssignment(schoolId, teacherUserId, data) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const section = await Section.findOne({ _id: data.sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  await assertTeacherCanMark({ teacherId: teacher._id, sectionId: data.sectionId, subject: data.subject });

  const slug = await Assignment.generateUniqueAssignmentSlug();

  return Assignment.create({
    slug,
    schoolId: sid,
    sectionId: data.sectionId,
    subject: data.subject,
    title: data.title,
    description: data.description,
    createdBy: teacher._id,
    dueDate: new Date(data.dueDate),
    attachments: data.attachments,
  });
}

/**
 * Assignments created by the logged-in teacher, with live submission
 * counts (submitted+graded / total active students in that section) —
 * matches the "0/45" style display in TeacherAcademics.
 */
export async function getMyCreatedAssignments(schoolId, teacherUserId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const assignments = await Assignment.find({ createdBy: teacher._id, schoolId: sid, isActive: true })
    .populate("sectionId", "gradeClass section")
    .sort({ dueDate: 1 });

  return Promise.all(
    assignments.map(async (a) => {
      const [totalStudents, submittedCount] = await Promise.all([
        Student.countDocuments({ sectionId: a.sectionId._id, schoolId: sid, status: "ACTIVE" }),
        AssignmentSubmission.countDocuments({
          assignmentId: a._id,
          status: { $in: ["SUBMITTED", "GRADED"] },
        }),
      ]);
      return { ...a.toObject(), totalStudents, submittedCount };
    })
  );
}

/**
 * Assignments visible to the logged-in student — everything assigned to
 * their own section, each annotated with their own submission status (or
 * "IN_PROGRESS" as the default if they haven't touched it yet).
 */
export async function getMyVisibleAssignments(schoolId, studentUserId) {
  const sid = targetSchoolId(schoolId);
  const student = await resolveStudent(sid, studentUserId);

  if (!student.sectionId) {
    throw new AppError("Your section is not yet assigned — contact your school", 400);
  }

  const assignments = await Assignment.find({
    sectionId: student.sectionId,
    schoolId: sid,
    isActive: true,
  })
    .populate("sectionId", "gradeClass section")
    .populate("createdBy", "firstName lastName")
    .sort({ dueDate: 1 });

  const submissions = await AssignmentSubmission.find({
    studentId: student._id,
    assignmentId: { $in: assignments.map((a) => a._id) },
  });
  const byAssignmentId = new Map(submissions.map((s) => [String(s.assignmentId), s]));

  return assignments.map((a) => {
    const sub = byAssignmentId.get(String(a._id));
    return {
      ...a.toObject(),
      submission: sub
        ? { status: sub.status, marks: sub.marks, feedback: sub.feedback, attachments: sub.attachments }
        : { status: "IN_PROGRESS", marks: "", feedback: "", attachments: [] },
    };
  });
}

/**
 * Full detail for one assignment, including the requesting student's own
 * submission (self-only) or, for a TEACHER/SCHOOL, the full roster's
 * submission states.
 */
export async function getAssignmentDetail(schoolId, slug, user) {
  const sid = targetSchoolId(schoolId);
  const assignment = await Assignment.findOne({ slug, schoolId: sid, isActive: true })
    .populate("sectionId", "gradeClass section")
    .populate("createdBy", "firstName lastName");
  if (!assignment) throw new AppError("Assignment not found", 404);

  if (user.role === "STUDENT") {
    const student = await resolveStudent(sid, user._id);
    if (String(student.sectionId) !== String(assignment.sectionId._id)) {
      throw new AppError("This assignment is not for your section", 403);
    }
    const submission = await AssignmentSubmission.findOne({
      assignmentId: assignment._id,
      studentId: student._id,
    });
    return {
      assignment,
      submission: submission || { status: "IN_PROGRESS", marks: "", feedback: "", attachments: [] },
    };
  }

  // TEACHER / SCHOOL — full roster submission states.
  const submissions = await AssignmentSubmission.find({ assignmentId: assignment._id }).populate(
    "studentId",
    "firstName lastName rollNumber slug"
  );
  return { assignment, submissions };
}

/**
 * Student submits (or re-submits) an assignment. Upserts the
 * AssignmentSubmission row rather than requiring it to pre-exist.
 */
export async function submitAssignment(schoolId, studentUserId, slug, { attachments }) {
  const sid = targetSchoolId(schoolId);
  const student = await resolveStudent(sid, studentUserId);

  const assignment = await Assignment.findOne({ slug, schoolId: sid, isActive: true });
  if (!assignment) throw new AppError("Assignment not found", 404);

  if (String(student.sectionId) !== String(assignment.sectionId)) {
    throw new AppError("This assignment is not for your section", 403);
  }

  const submission = await AssignmentSubmission.findOneAndUpdate(
    { assignmentId: assignment._id, studentId: student._id },
    {
      $set: {
        schoolId: sid,
        status: "SUBMITTED",
        attachments,
        submittedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return submission;
}

/**
 * Teacher grades a student's submission. Only the teacher who created the
 * assignment (or, more loosely, any teacher assigned to that section+
 * subject) may grade — enforced via the same assertTeacherCanMark check.
 */
export async function gradeSubmission(schoolId, teacherUserId, assignmentSlug, studentSlug, { marks, feedback }) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const assignment = await Assignment.findOne({ slug: assignmentSlug, schoolId: sid });
  if (!assignment) throw new AppError("Assignment not found", 404);

  await assertTeacherCanMark({
    teacherId: teacher._id,
    sectionId: assignment.sectionId,
    subject: assignment.subject,
  });

  const student = await Student.findOne({ slug: studentSlug, schoolId: sid });
  if (!student) throw new AppError("Student not found", 404);

  const submission = await AssignmentSubmission.findOneAndUpdate(
    { assignmentId: assignment._id, studentId: student._id },
    {
      $set: {
        status: "GRADED",
        marks,
        feedback,
        gradedBy: teacher._id,
        gradedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return submission;
}
