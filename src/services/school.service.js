import AppError from "../utils/AppError.js";
import { hashPassword } from "../lib/bcrypt.js";
import { sendVerificationEmail } from "../utils/email.js";
import { hashToken, generateRawToken } from "../utils/tokens.js";
import {
  generateLoginAlias,
  generateTempPassword,
} from "../utils/loginAlias.js";
import env from "../config/env.js";
import User from "../models/User.js";
import School from "../models/School.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Staff from "../models/Staff.js";
import { ROLES } from "../models/constants.js";

/**
 * Provision a Teacher invitation.
 *
 * Creates a User (emailVerified=false, mustChangePassword=true) with a
 * generated login alias. The Teacher role-profile is NOT created here — it's
 * created in `verifyEmailService` once the user clicks the verify link in
 * their contact email. The principal gets back the alias + slug so they can
 * tell the teacher "your login ID is X".
 */
export async function createTeacherAccount(schoolId, data) {
  const targetSchoolId = schoolId?._id || schoolId;

  // Prevent accidental collision with an already-invited contactEmail.
  const existingByContact = await User.findOne({
    contactEmail: String(data.contactEmail).toLowerCase(),
    schoolId: targetSchoolId,
  });
  if (existingByContact) {
    throw new AppError(
      "A user with this contact email already exists in your school.",
      400
    );
  }

  const tempPassword = generateTempPassword(12);
  const hashedPassword = await hashPassword(tempPassword);
  const userSlug = await User.generateUniqueUserSlug();
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  const verificationRaw = generateRawToken();
  const verificationHash = hashToken(verificationRaw);

  let user;
  let alias;
  for (let attempt = 0; attempt < 6; attempt++) {
    alias = generateLoginAlias(data.firstName, data.lastName);
    try {
      // eslint-disable-next-line no-await-in-loop
      user = await User.create({
        slug: userSlug,
        name: fullName,
        email: alias,
        contactEmail: String(data.contactEmail).toLowerCase(),
        password: hashedPassword,
        role: ROLES.TEACHER,
        schoolId: targetSchoolId,
        emailVerified: false,
        mustChangePassword: true,
        verificationToken: verificationHash,
        verificationExpires: new Date(Date.now() + _verificationTtlMs()),
        metadata: {
          invitePayload: {
            roleModel: "Teacher",
            schoolId: targetSchoolId,
            tempPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            phone: data.phone || "",
            qualification: data.qualification || "",
            experience: Number(data.experience) || 0,
            subjects: data.subjects || [],
            employeeId: data.employeeId,
          },
        },
      });
      break;
    } catch (err) {
      if (err && err.code === 11000 && attempt < 5) continue; // retry alias
      throw err;
    }
  }

  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationRaw}&id=${user._id}`;

  await sendVerificationEmail({
    to: user.contactEmail,
    name: fullName,
    role: "Teacher",
    verifyUrl,
  });

  return {
    slug: user.slug,
    alias: user.email,
    contactEmail: user.contactEmail,
    status: "pending_verification",
    userId: user._id,
  };
}

/**
 * Provision a Student invitation. Same shape as createTeacherAccount but
 * uses the Student role-model and student-specific fields.
 */
export async function createStudentAccount(schoolId, data) {
  const targetSchoolId = schoolId?._id || schoolId;

  const existingByContact = await User.findOne({
    contactEmail: String(data.contactEmail).toLowerCase(),
    schoolId: targetSchoolId,
  });
  if (existingByContact) {
    throw new AppError(
      "A user with this contact email already exists in your school.",
      400
    );
  }

  // Verify assignedTeacherId (if provided) belongs to the same school.
  if (data.assignedTeacherId) {
    const t = await Teacher.findOne({
      _id: data.assignedTeacherId,
      schoolId: targetSchoolId,
    });
    if (!t) {
      throw new AppError("assignedTeacherId does not belong to your school", 400);
    }
  }

  const tempPassword = generateTempPassword(12);
  const hashedPassword = await hashPassword(tempPassword);
  const userSlug = await User.generateUniqueUserSlug();
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  const verificationRaw = generateRawToken();
  const verificationHash = hashToken(verificationRaw);

  let user;
  let alias;
  for (let attempt = 0; attempt < 6; attempt++) {
    alias = generateLoginAlias(data.firstName, data.lastName);
    try {
      // eslint-disable-next-line no-await-in-loop
      user = await User.create({
        slug: userSlug,
        name: fullName,
        email: alias,
        contactEmail: String(data.contactEmail).toLowerCase(),
        password: hashedPassword,
        role: ROLES.STUDENT,
        schoolId: targetSchoolId,
        emailVerified: false,
        mustChangePassword: true,
        verificationToken: verificationHash,
        verificationExpires: new Date(Date.now() + _verificationTtlMs()),
        metadata: {
          invitePayload: {
            roleModel: "Student",
            schoolId: targetSchoolId,
            tempPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            gradeClass: data.gradeClass,
            section: data.section || "A",
            parentName: data.parentName || "",
            contactEmail: data.contactEmail
              ? String(data.contactEmail).toLowerCase()
              : "",
            parentPhone: data.parentPhone || "",
            address: data.address || "",
            rollNumber: data.rollNumber,
            assignedTeacherId: data.assignedTeacherId || null,
          },
        },
      });
      break;
    } catch (err) {
      if (err && err.code === 11000 && attempt < 5) continue;
      throw err;
    }
  }

  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationRaw}&id=${user._id}`;

  await sendVerificationEmail({
    to: user.contactEmail,
    name: fullName,
    role: "Student",
    verifyUrl,
  });

  return {
    slug: user.slug,
    alias: user.email,
    contactEmail: user.contactEmail,
    status: "pending_verification",
    userId: user._id,
  };
}

/**
 * Provision a non-teaching Staff invitation (Lab Assistant, Librarian,
 * Cashier, etc.). Same invite-then-verify shape as Teacher/Student.
 */
export async function createStaffAccount(schoolId, data) {
  const targetSchoolId = schoolId?._id || schoolId;

  const existingByContact = await User.findOne({
    contactEmail: String(data.contactEmail).toLowerCase(),
    schoolId: targetSchoolId,
  });
  if (existingByContact) {
    throw new AppError(
      "A user with this contact email already exists in your school.",
      400
    );
  }

  const tempPassword = generateTempPassword(12);
  const hashedPassword = await hashPassword(tempPassword);
  const userSlug = await User.generateUniqueUserSlug();
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  const verificationRaw = generateRawToken();
  const verificationHash = hashToken(verificationRaw);

  let user;
  let alias;
  for (let attempt = 0; attempt < 6; attempt++) {
    alias = generateLoginAlias(data.firstName, data.lastName);
    try {
      // eslint-disable-next-line no-await-in-loop
      user = await User.create({
        slug: userSlug,
        name: fullName,
        email: alias,
        contactEmail: String(data.contactEmail).toLowerCase(),
        password: hashedPassword,
        role: ROLES.STAFF,
        schoolId: targetSchoolId,
        emailVerified: false,
        mustChangePassword: true,
        verificationToken: verificationHash,
        verificationExpires: new Date(Date.now() + _verificationTtlMs()),
        metadata: {
          invitePayload: {
            roleModel: "Staff",
            schoolId: targetSchoolId,
            tempPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            phone: data.phone || "",
            qualification: data.qualification || "",
            experience: Number(data.experience) || 0,
            staffType: data.staffType,
            customTitle: data.customTitle || "",
            department: data.department || "",
            employeeId: data.employeeId,
          },
        },
      });
      break;
    } catch (err) {
      if (err && err.code === 11000 && attempt < 5) continue; // retry alias
      throw err;
    }
  }

  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationRaw}&id=${user._id}`;

  await sendVerificationEmail({
    to: user.contactEmail,
    name: fullName,
    role: "Staff",
    verifyUrl,
  });

  return {
    slug: user.slug,
    alias: user.email,
    contactEmail: user.contactEmail,
    status: "pending_verification",
    userId: user._id,
  };
}

/**
 * List teachers in a school, paginated + search across employeeId/firstName/lastName.
 */
export async function getSchoolTeachers(schoolId, { search, page, limit } = {}) {
  const targetSchoolId = schoolId?._id || schoolId;
  const filter = { schoolId: targetSchoolId };
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: re }, { lastName: re }, { employeeId: re }];
  }
  return _paginate(
    Teacher.find(filter)
      .populate("userId", "name email role isActive mustChangePassword slug")
      .sort({ createdAt: -1 }),
    { page, limit }
  );
}

/**
 * List students in a school, paginated + search across rollNumber/firstName/lastName.
 */
export async function getSchoolStudents(schoolId, { search, page, limit } = {}) {
  const targetSchoolId = schoolId?._id || schoolId;
  const filter = { schoolId: targetSchoolId };
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: re }, { lastName: re }, { rollNumber: re }];
  }
  return _paginate(
    Student.find(filter)
      .populate("userId", "name email role isActive mustChangePassword slug")
      .populate("assignedTeacherId", "firstName lastName employeeId slug")
      .sort({ createdAt: -1 }),
    { page, limit }
  );
}

/**
 * List non-teaching staff in a school, paginated + search across
 * employeeId/firstName/lastName. Optionally filter by staffType.
 */
export async function getSchoolStaff(
  schoolId,
  { search, page, limit, staffType } = {}
) {
  const targetSchoolId = schoolId?._id || schoolId;
  const filter = { schoolId: targetSchoolId };
  if (staffType) filter.staffType = staffType;
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: re }, { lastName: re }, { employeeId: re }];
  }
  return _paginate(
    Staff.find(filter)
      .populate("userId", "name email role isActive mustChangePassword slug")
      .sort({ createdAt: -1 }),
    { page, limit }
  );
}

export async function updateStaffAccount(schoolId, slug, patch) {
  const staff = await Staff.findOne({ slug, schoolId });
  if (!staff) throw new AppError("Staff member not found", 404);
  const allowed = [
    "firstName",
    "lastName",
    "gender",
    "phone",
    "qualification",
    "experience",
    "staffType",
    "customTitle",
    "department",
    "status",
  ];
  for (const k of allowed) if (k in patch) staff[k] = patch[k];
  await staff.save();
  return staff;
}

export async function removeStaffAccount(schoolId, slug) {
  const staff = await Staff.findOne({ slug, schoolId });
  if (!staff) throw new AppError("Staff member not found", 404);
  await Staff.findByIdAndDelete(staff._id);
  await User.findByIdAndDelete(staff.userId);
  return { message: "Staff account deleted successfully." };
}

export async function updateTeacherAccount(schoolId, slug, patch) {
  const teacher = await Teacher.findOne({ slug, schoolId });
  if (!teacher) throw new AppError("Teacher not found", 404);
  const allowed = [
    "firstName",
    "lastName",
    "gender",
    "phone",
    "qualification",
    "experience",
    "subjects",
    "status",
  ];
  for (const k of allowed) if (k in patch) teacher[k] = patch[k];
  await teacher.save();
  return teacher;
}

export async function updateStudentAccount(schoolId, slug, patch) {
  const student = await Student.findOne({ slug, schoolId });
  if (!student) throw new AppError("Student not found", 404);

  if (patch.assignedTeacherId) {
    const t = await Teacher.findOne({ _id: patch.assignedTeacherId, schoolId });
    if (!t)
      throw new AppError("assignedTeacherId does not belong to your school", 400);
  }

  const allowed = [
    "firstName",
    "middleName",
    "lastName",
    "motherName",
    "gradeClass",
    "section",
    "gender",
    "dateOfBirth",
    "parentName",
    "parentEmail",
    "parentPhone",
    "address",
    "assignedTeacherId",
    "status",
    "rollNumber",
  ];
  for (const k of allowed) if (k in patch) student[k] = patch[k];
  await student.save();
  return student;
}

export async function removeTeacherAccount(schoolId, slug) {
  const teacher = await Teacher.findOne({ slug, schoolId });
  if (!teacher) throw new AppError("Teacher not found", 404);

  await Student.updateMany(
    { assignedTeacherId: teacher._id },
    { $set: { assignedTeacherId: null } }
  );
  await Teacher.findByIdAndDelete(teacher._id);
  await User.findByIdAndDelete(teacher.userId);
  return {
    message:
      "Teacher account deleted. Assigned students were unassigned but kept active.",
  };
}

export async function removeStudentAccount(schoolId, slug) {
  const student = await Student.findOne({ slug, schoolId });
  if (!student) throw new AppError("Student not found", 404);

  await Student.findByIdAndDelete(student._id);
  await User.findByIdAndDelete(student.userId);
  return { message: "Student account deleted successfully." };
}

/* ===========================
   School profile
=========================== */
export async function updateSchoolProfile(schoolId, patch) {
  const school = await School.findById(schoolId);
  if (!school) throw new AppError("School not found", 404);
  const allowed = ["schoolName", "phone", "address", "logo"];
  for (const k of allowed) if (k in patch) school[k] = patch[k];
  await school.save();
  return school;
}

/* ===========================
   Helpers
=========================== */

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _verificationTtlMs() {
  const { EMAIL_VERIFICATION_TTL = "24h" } = process.env;
  const m = String(EMAIL_VERIFICATION_TTL).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * mult;
}

async function _paginate(query, { page = 1, limit = 25 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const total = await query.model.countDocuments(query.getFilter());
  const items = await query.skip((safePage - 1) * safeLimit).limit(safeLimit);
  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}