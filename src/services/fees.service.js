import mongoose from "mongoose";
import FeeStructure from "../models/FeeStructure.js";
import StudentFee, { STUDENT_FEE_STATUS } from "../models/StudentFee.js";
import Payment from "../models/Payment.js";
import Student from "../models/Student.js";
import AppError from "../utils/AppError.js";

/**
 * India-style academic year default: April -> March.
 * e.g. called in Nov 2026 -> "2026-27"; called in Feb 2027 -> "2026-27".
 */
export function getCurrentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, April = 3
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function toStudentSummary(student) {
  return {
    id: student.slug,
    name: [student.firstName, student.middleName, student.lastName]
      .filter(Boolean)
      .join(" "),
    rollNumber: student.rollNumber,
    class: `${student.gradeClass}-${student.section}`,
    gradeClass: student.gradeClass,
    section: student.section,
    guardianName: student.parentName,
    phone: student.parentPhone,
    email: student.parentEmail,
    address: student.address,
  };
}

function serializeStudentFee(fee, student) {
  return {
    studentFeeId: fee._id.toString(),
    academicYear: fee.academicYear,
    totalFees: fee.totalFees,
    paidAmount: fee.paidAmount,
    pendingAmount: fee.pendingAmount,
    status: fee.status,
    dueDate: fee.dueDate,
    breakdown: fee.breakdown.map((l) => ({
      particular: l.particular,
      amount: l.amount,
      paidAmount: l.paidAmount,
      pendingAmount: Math.max(l.amount - l.paidAmount, 0),
    })),
    ...(student ? toStudentSummary(student) : {}),
  };
}

async function findStudentBySlugOrThrow(schoolId, slug) {
  const student = await Student.findOne({ schoolId, slug });
  if (!student) throw new AppError("Student not found", 404);
  return student;
}

// ---------------------------------------------------------------------------
// Fee Structures (templates)
// ---------------------------------------------------------------------------

export async function upsertFeeStructure(schoolId, userId, data) {
  const heads = data.heads.map((h) => ({
    particular: h.particular,
    amount: h.amount,
  }));
  // Computed here explicitly — findOneAndUpdate is a query-level operation
  // and does not run the schema's pre('validate') document middleware, so
  // relying on that hook alone left totalAmount unset on every upsert.
  const totalAmount = heads.reduce((sum, h) => sum + h.amount, 0);

  const structure = await FeeStructure.findOneAndUpdate(
    {
      schoolId,
      academicYear: data.academicYear,
      gradeClass: data.gradeClass,
    },
    {
      $set: {
        heads,
        totalAmount,
        dueDate: data.dueDate ?? null,
        isActive: true,
        createdBy: userId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  return structure;
}

export async function getFeeStructures(schoolId, { academicYear } = {}) {
  const filter = { schoolId };
  if (academicYear) filter.academicYear = academicYear;
  return FeeStructure.find(filter).sort({ gradeClass: 1 });
}

// ---------------------------------------------------------------------------
// Assigning fees to students
// ---------------------------------------------------------------------------

/**
 * Snapshot a FeeStructure onto a single student's ledger for a year.
 * If the student already has a ledger for that year, it's left untouched
 * unless `force` is passed — editing an existing ledger goes through
 * assignStudentFeeDirect instead (explicit per-student override).
 */
async function createLedgerFromStructure(student, structure, { force = false } = {}) {
  const existing = await StudentFee.findOne({
    schoolId: student.schoolId,
    studentId: student._id,
    academicYear: structure.academicYear,
  });
  if (existing && !force) return existing;

  const breakdown = structure.heads.map((h) => ({
    particular: h.particular,
    amount: h.amount,
    paidAmount: existing
      ? existing.breakdown.find((l) => l.particular === h.particular)?.paidAmount || 0
      : 0,
  }));

  if (existing) {
    existing.feeStructureId = structure._id;
    existing.breakdown = breakdown;
    existing.dueDate = structure.dueDate;
    existing.gradeClass = student.gradeClass;
    existing.section = student.section;
    await existing.save();
    return existing;
  }

  return StudentFee.create({
    schoolId: student.schoolId,
    studentId: student._id,
    feeStructureId: structure._id,
    academicYear: structure.academicYear,
    gradeClass: student.gradeClass,
    section: student.section,
    breakdown,
    dueDate: structure.dueDate,
  });
}

export async function bulkAssignFeeToClass(schoolId, { academicYear, gradeClass, skipExisting = true }) {
  const structure = await FeeStructure.findOne({ schoolId, academicYear, gradeClass });
  if (!structure) {
    throw new AppError(
      `No fee structure defined for class ${gradeClass} in ${academicYear}. Create one first.`,
      404
    );
  }

  const students = await Student.find({ schoolId, gradeClass, status: "ACTIVE" });
  let created = 0;
  let skipped = 0;

  for (const student of students) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await StudentFee.findOne({
      schoolId,
      studentId: student._id,
      academicYear,
    });
    if (existing && skipExisting) {
      skipped += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await createLedgerFromStructure(student, structure, { force: !skipExisting });
    created += 1;
  }

  return { totalStudents: students.length, assigned: created, skipped };
}

export async function assignStudentFeeDirect(schoolId, studentSlug, data) {
  const student = await findStudentBySlugOrThrow(schoolId, studentSlug);

  // Ensure a structure exists for bookkeeping (createdBy/dueDate reference),
  // but the student's own breakdown below is authoritative for their ledger.
  let structure = await FeeStructure.findOne({
    schoolId,
    academicYear: data.academicYear,
    gradeClass: student.gradeClass,
  });
  if (!structure) {
    throw new AppError(
      `No fee structure defined for class ${student.gradeClass} in ${data.academicYear}. Create one first, then assign per-student overrides.`,
      404
    );
  }

  const existing = await StudentFee.findOne({
    schoolId,
    studentId: student._id,
    academicYear: data.academicYear,
  });

  const breakdown = data.heads.map((h) => ({
    particular: h.particular,
    amount: h.amount,
    paidAmount:
      existing?.breakdown.find((l) => l.particular === h.particular)?.paidAmount || 0,
  }));

  if (existing) {
    existing.breakdown = breakdown;
    existing.dueDate = data.dueDate ?? existing.dueDate;
    await existing.save();
    return existing;
  }

  return StudentFee.create({
    schoolId,
    studentId: student._id,
    feeStructureId: structure._id,
    academicYear: data.academicYear,
    gradeClass: student.gradeClass,
    section: student.section,
    breakdown,
    dueDate: data.dueDate ?? null,
  });
}

// ---------------------------------------------------------------------------
// Listing / stats (principal & teacher read views)
// ---------------------------------------------------------------------------

export async function listSchoolFees(schoolId, filters = {}) {
  const {
    academicYear = getCurrentAcademicYear(),
    gradeClass,
    status,
    feeCategory,
    search,
    page = 1,
    limit = 200,
  } = filters;

  const feeFilter = { schoolId, academicYear };
  if (gradeClass && gradeClass !== "ALL") feeFilter.gradeClass = gradeClass;
  if (status && status !== "ALL") feeFilter.status = status;
  if (feeCategory && feeCategory !== "ALL") {
    feeFilter["breakdown.particular"] = { $regex: feeCategory, $options: "i" };
  }

  let fees = await StudentFee.find(feeFilter)
    .sort({ updatedAt: -1 })
    .populate({
      path: "studentId",
      select: "slug firstName middleName lastName rollNumber gradeClass section parentName parentPhone parentEmail address status",
    });

  // Drop ledgers whose student record is missing/inactive, then apply
  // free-text search across name/roll number (kept in-memory — school-scale
  // rosters are small enough for this to stay fast; move to $lookup + $match
  // in the aggregation pipeline if you outgrow it).
  fees = fees.filter((f) => f.studentId);

  if (search) {
    const q = search.toLowerCase();
    fees = fees.filter((f) => {
      const s = f.studentId;
      const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ").toLowerCase();
      return fullName.includes(q) || s.rollNumber.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
    });
  }

  const total = fees.length;
  const start = (page - 1) * limit;
  const paged = fees.slice(start, start + limit);

  return {
    students: paged.map((f) => serializeStudentFee(f, f.studentId)),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getFeeStats(schoolId, academicYear = getCurrentAcademicYear()) {
  const [agg] = await StudentFee.aggregate([
    { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), academicYear } },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        totalFees: { $sum: "$totalFees" },
        totalCollected: { $sum: "$paidAmount" },
        totalPending: { $sum: "$pendingAmount" },
        paidCount: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] } },
        partialCount: { $sum: { $cond: [{ $eq: ["$status", "Partial Paid"] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
      },
    },
  ]);

  const totals = agg || {
    totalStudents: 0,
    totalFees: 0,
    totalCollected: 0,
    totalPending: 0,
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0,
  };

  const collectionRate = totals.totalFees > 0
    ? Math.round((totals.totalCollected / totals.totalFees) * 1000) / 10
    : 0;

  return {
    academicYear,
    totalStudents: totals.totalStudents,
    totalFees: totals.totalFees,
    totalCollected: totals.totalCollected,
    totalPending: totals.totalPending,
    collectionRate,
    statusBreakdown: {
      Paid: totals.paidCount,
      "Partial Paid": totals.partialCount,
      Pending: totals.pendingCount,
    },
  };
}

export async function getStudentFeeDetail(schoolId, studentSlug, academicYear = getCurrentAcademicYear()) {
  const student = await findStudentBySlugOrThrow(schoolId, studentSlug);
  const fee = await StudentFee.findOne({ schoolId, studentId: student._id, academicYear });
  if (!fee) {
    throw new AppError(
      `No fee ledger for ${student.firstName} ${student.lastName} in ${academicYear} yet. Assign a fee structure first.`,
      404
    );
  }
  const payments = await Payment.find({ schoolId, studentId: student._id, studentFeeId: fee._id })
    .sort({ paidAt: -1 });

  return {
    ...serializeStudentFee(fee, student),
    payments: payments.map(serializePayment),
  };
}

function serializePayment(p) {
  return {
    id: p.slug,
    receiptNumber: p.receiptNumber,
    amount: p.amount,
    method: p.method,
    status: p.status,
    referenceNo: p.referenceNo,
    note: p.note,
    allocations: p.allocations,
    paidAt: p.paidAt,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function generateReceiptNumber(schoolCode) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCPT-${schoolCode || "SCH"}-${stamp}-${rand}`;
}

/**
 * Spread a payment across unpaid fee-head lines, oldest-first (array order),
 * when the caller hasn't specified an explicit split.
 */
function autoAllocate(breakdown, amount) {
  let remaining = amount;
  const allocations = [];
  for (const line of breakdown) {
    if (remaining <= 0) break;
    const due = line.amount - line.paidAmount;
    if (due <= 0) continue;
    const take = Math.min(due, remaining);
    line.paidAmount += take;
    allocations.push({ particular: line.particular, amount: take });
    remaining -= take;
  }
  return { allocations, overpaid: remaining };
}

function applyExplicitAllocations(breakdown, allocations) {
  for (const alloc of allocations) {
    const line = breakdown.find((l) => l.particular === alloc.particular);
    if (!line) {
      throw new AppError(`Unknown fee particular in allocation: ${alloc.particular}`, 400);
    }
    const due = line.amount - line.paidAmount;
    if (alloc.amount > due + 0.01) {
      throw new AppError(
        `Allocation for "${alloc.particular}" (${alloc.amount}) exceeds what's still due (${due}).`,
        400
      );
    }
    line.paidAmount += alloc.amount;
  }
}

export async function recordPayment(schoolId, userId, studentSlug, data, schoolCode) {
  const student = await findStudentBySlugOrThrow(schoolId, studentSlug);
  const academicYear = getCurrentAcademicYear(data.paidAt);
  const fee = await StudentFee.findOne({ schoolId, studentId: student._id, academicYear });
  if (!fee) {
    throw new AppError(
      `No fee ledger for ${student.firstName} ${student.lastName} in ${academicYear}. Assign fees before recording a payment.`,
      404
    );
  }

  if (data.amount > fee.pendingAmount + 0.01) {
    throw new AppError(
      `Payment (${data.amount}) exceeds the outstanding balance (${fee.pendingAmount}).`,
      400
    );
  }

  let allocations;
  if (data.allocations?.length) {
    applyExplicitAllocations(fee.breakdown, data.allocations);
    allocations = data.allocations;
  } else {
    const result = autoAllocate(fee.breakdown, data.amount);
    allocations = result.allocations;
  }

  await fee.save(); // recalculates totals/status via pre-save hook

  const payment = await Payment.create({
    schoolId,
    studentId: student._id,
    studentFeeId: fee._id,
    receiptNumber: generateReceiptNumber(schoolCode),
    amount: data.amount,
    method: data.method,
    status: "SUCCESS",
    allocations,
    referenceNo: data.referenceNo || "",
    note: data.note || "",
    recordedBy: userId,
    paidAt: data.paidAt || new Date(),
    slug: await Payment.generateUniquePaymentSlug(),
  });

  return { fee: serializeStudentFee(fee, student), payment: serializePayment(payment) };
}

// ---------------------------------------------------------------------------
// Student self-service (STUDENT role)
// ---------------------------------------------------------------------------

export async function getMyFee(schoolId, studentId, academicYear = getCurrentAcademicYear()) {
  const student = await Student.findById(studentId);
  if (!student) throw new AppError("Student profile not found", 404);

  const fee = await StudentFee.findOne({ schoolId, studentId, academicYear });
  if (!fee) {
    return {
      ...toStudentSummary(student),
      academicYear,
      totalFees: 0,
      paidAmount: 0,
      pendingAmount: 0,
      status: "Pending",
      breakdown: [],
      dueDate: null,
      unassigned: true,
    };
  }
  return serializeStudentFee(fee, student);
}

export async function getMyPayments(schoolId, studentId) {
  const payments = await Payment.find({ schoolId, studentId }).sort({ paidAt: -1 });
  return payments.map(serializePayment);
}

// ---------------------------------------------------------------------------
// Classes — sourced from the live Student roster, independent of whether any
// fee structure/ledger exists yet. This is what powers the Class & Section
// filter and the Allocate Fees class picker.
// ---------------------------------------------------------------------------

export async function getSchoolClasses(schoolId) {
  const rows = await Student.aggregate([
    { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), status: "ACTIVE" } },
    {
      $group: {
        _id: { gradeClass: "$gradeClass", section: "$section" },
        studentCount: { $sum: 1 },
      },
    },
  ]);

  const naturalCompare = (a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  };

  const sections = rows
    .map((r) => ({
      gradeClass: r._id.gradeClass,
      section: r._id.section,
      class: `${r._id.gradeClass}-${r._id.section}`,
      studentCount: r.studentCount,
    }))
    .sort((a, b) => naturalCompare(a.gradeClass, b.gradeClass) || naturalCompare(a.section, b.section));

  const gradeClasses = Array.from(new Set(sections.map((s) => s.gradeClass))).sort(naturalCompare);

  return { sections, gradeClasses };
}

export { STUDENT_FEE_STATUS };
