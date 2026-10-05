import AppError from "../utils/AppError.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Section from "../models/Section.js";
import { ROLES } from "../models/constants.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

/**
 * Apply for leave as the currently logged-in user (STUDENT or TEACHER,
 * enforced at the route level). Resolves the applicant's own role-profile
 * to attach sectionId for students, so approval routing works later.
 */
export async function applyForLeave(user, data) {
  const sid = targetSchoolId(user.schoolId);
  const slug = await LeaveRequest.generateUniqueLeaveSlug();

  let sectionId = null;
  if (user.role === ROLES.STUDENT) {
    const student = await Student.findOne({ userId: user._id, schoolId: sid });
    if (!student) throw new AppError("Student profile not found", 404);
    if (!student.sectionId) {
      throw new AppError(
        "Your section is not yet assigned — contact your school to apply for leave",
        400
      );
    }
    sectionId = student.sectionId;
  } else if (user.role === ROLES.TEACHER) {
    const teacher = await Teacher.findOne({ userId: user._id, schoolId: sid });
    if (!teacher) throw new AppError("Teacher profile not found", 404);
  } else {
    throw new AppError("Only students and teachers can apply for leave", 403);
  }

  const leave = await LeaveRequest.create({
    slug,
    schoolId: sid,
    applicantUserId: user._id,
    applicantRole: user.role,
    sectionId,
    fromDate: new Date(data.fromDate),
    toDate: new Date(data.toDate),
    reason: data.reason,
  });

  return leave;
}

export async function getMyLeaves(user) {
  const sid = targetSchoolId(user.schoolId);
  return LeaveRequest.find({ applicantUserId: user._id, schoolId: sid }).sort({
    createdAt: -1,
  });
}

/**
 * The approvals inbox. Scope differs by role:
 *  - TEACHER: only STUDENT leaves for section(s) where they are the
 *    classTeacherId — a teacher never sees another teacher's leaves, and
 *    never sees student leaves for sections they don't head.
 *  - SCHOOL: only TEACHER leaves, school-wide.
 */
export async function getLeaveInbox(user, { status } = {}) {
  const sid = targetSchoolId(user.schoolId);

  if (user.role === ROLES.TEACHER) {
    const teacher = await Teacher.findOne({ userId: user._id, schoolId: sid });
    if (!teacher) throw new AppError("Teacher profile not found", 404);

    const headedSections = await Section.find({ classTeacherId: teacher._id, schoolId: sid }).select("_id");
    const sectionIds = headedSections.map((s) => s._id);

    const query = {
      schoolId: sid,
      applicantRole: ROLES.STUDENT,
      sectionId: { $in: sectionIds },
    };
    if (status) query.status = status;

    return LeaveRequest.find(query)
      .populate("applicantUserId", "name email")
      .sort({ createdAt: -1 });
  }

  if (user.role === ROLES.SCHOOL) {
    const query = { schoolId: sid, applicantRole: ROLES.TEACHER };
    if (status) query.status = status;

    return LeaveRequest.find(query)
      .populate("applicantUserId", "name email")
      .sort({ createdAt: -1 });
  }

  throw new AppError("Not authorized to view a leave inbox", 403);
}

async function assertCanReview(user, leave) {
  const sid = targetSchoolId(user.schoolId);

  if (leave.schoolId.toString() !== sid.toString()) {
    throw new AppError("Leave request not found", 404);
  }

  if (leave.applicantRole === ROLES.TEACHER) {
    if (user.role !== ROLES.SCHOOL) {
      throw new AppError("Only the school can review a teacher's leave", 403);
    }
    return;
  }

  // STUDENT leave — only the class teacher of that student's section may review.
  if (user.role !== ROLES.TEACHER) {
    throw new AppError("Only the class teacher can review a student's leave", 403);
  }

  const teacher = await Teacher.findOne({ userId: user._id, schoolId: sid });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  const section = await Section.findOne({ _id: leave.sectionId, schoolId: sid });
  if (!section || section.classTeacherId.toString() !== teacher._id.toString()) {
    throw new AppError("You are not the class teacher for this student's section", 403);
  }
}

async function reviewLeave(user, slug, status, reviewerNote) {
  const sid = targetSchoolId(user.schoolId);
  const leave = await LeaveRequest.findOne({ slug, schoolId: sid });
  if (!leave) throw new AppError("Leave request not found", 404);

  if (leave.status !== "PENDING") {
    throw new AppError(`This leave request has already been ${leave.status.toLowerCase()}`, 400);
  }

  await assertCanReview(user, leave);

  leave.status = status;
  leave.reviewedBy = user._id;
  leave.reviewedAt = new Date();
  leave.reviewerNote = reviewerNote || "";
  await leave.save();

  return leave;
}

export async function approveLeave(user, slug, reviewerNote) {
  return reviewLeave(user, slug, "APPROVED", reviewerNote);
}

export async function denyLeave(user, slug, reviewerNote) {
  return reviewLeave(user, slug, "DENIED", reviewerNote);
}
