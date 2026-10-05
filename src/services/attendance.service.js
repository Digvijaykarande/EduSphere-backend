import AppError from "../utils/AppError.js";
import Attendance from "../models/Attendance.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import { generateSlug } from "../utils/slug.js";
import { assertTeacherCanMark } from "./teacherAssignment.service.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

// Normalize any incoming date string/Date to UTC midnight so that a given
// calendar day always maps to exactly one Date value, matching the unique
// index on Attendance (studentId, sectionId, subject, period, date).
function normalizeToDay(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw new AppError("Invalid date", 400);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function resolveTeacher(schoolId, userId) {
  const teacher = await Teacher.findOne({ userId, schoolId });
  if (!teacher) throw new AppError("Teacher profile not found", 404);
  return teacher;
}

/**
 * Roster + existing marks for a given (section, subject, period, date) slot.
 * Powers SeatGrid / ListView / AttendanceMarkingGrid. Enforces that the
 * calling teacher is actually assigned to teach this subject for this
 * section — a 403, not a filtered/empty result, so the frontend can surface
 * a clear "not your class" state instead of a confusing blank grid.
 */
export async function getRosterForSlot(schoolId, teacherUserId, { sectionId, subject, period, date }) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const section = await Section.findOne({ _id: sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  await assertTeacherCanMark({ teacherId: teacher._id, sectionId, subject });

  const day = normalizeToDay(date);

  const [students, existingMarks] = await Promise.all([
    Student.find({ sectionId, schoolId: sid, status: "ACTIVE" }).sort({ rollNumber: 1 }),
    Attendance.find({ sectionId, schoolId: sid, subject, period, date: day }),
  ]);

  const markByStudentId = new Map(
    existingMarks.map((m) => [String(m.studentId), m.status])
  );

  // Term-to-date attendance % per student, replacing what used to be
  // hardcoded mock data ("96%" etc.) in the frontend. Computed as
  // present / (present + absent + late) across all of that student's
  // historical records, so a student with zero history reads as 100%
  // (nothing counted against them yet) rather than 0%/NaN.
  const overallPctByStudentId = await computeOverallAttendancePct(
    sid,
    students.map((s) => s._id)
  );

  const roster = students.map((s) => ({
    studentId: s._id,
    slug: s.slug,
    rollNumber: s.rollNumber,
    name: `${s.firstName} ${s.lastName}`.trim(),
    status: markByStudentId.get(String(s._id)) || "not-marked",
    overallAttendancePct: overallPctByStudentId.get(String(s._id)) ?? 100,
  }));

  return { section, date: day, subject, period, roster };
}

/**
 * Batch-compute term-to-date attendance % for a set of students in one
 * aggregation query, rather than N+1 per-student queries.
 */
async function computeOverallAttendancePct(schoolId, studentIds) {
  const rows = await Attendance.aggregate([
    { $match: { schoolId, studentId: { $in: studentIds } } },
    {
      $group: {
        _id: "$studentId",
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      },
    },
  ]);

  const map = new Map();
  for (const r of rows) {
    const pct = r.total ? Math.round((r.present / r.total) * 1000) / 10 : 100;
    map.set(String(r._id), pct);
  }
  return map;
}

/**
 * Bulk upsert marks for a slot. Idempotent by design (unique index on
 * studentId+sectionId+subject+period+date) — re-saving the same slot
 * overwrites rather than duplicating, matching the Save button / bulk
 * actions / single-cell edits in the frontend, all of which end up calling
 * this the same way.
 */
export async function markAttendance(schoolId, teacherUserId, { sectionId, subject, period, date, marks }) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const section = await Section.findOne({ _id: sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  await assertTeacherCanMark({ teacherId: teacher._id, sectionId, subject });

  const day = normalizeToDay(date);
  const studentIds = marks.map((m) => m.studentId);

  // Confirm every studentId actually belongs to this section+school, so a
  // teacher can't slip in marks for a student outside their roster.
  const validCount = await Student.countDocuments({
    _id: { $in: studentIds },
    sectionId,
    schoolId: sid,
  });
  if (validCount !== studentIds.length) {
    throw new AppError("One or more students do not belong to this section", 400);
  }

  const now = new Date();
  const ops = marks.map(({ studentId, status }) => ({
    updateOne: {
      filter: { studentId, sectionId, subject, period, date: day },
      update: {
        $set: {
          schoolId: sid,
          status,
          markedBy: teacher._id,
          markedAt: now,
        },
        $setOnInsert: {
          slug: generateSlug("att"),
        },
      },
      upsert: true,
    },
  }));

  await Attendance.bulkWrite(ops);

  const saved = await Attendance.find({ sectionId, subject, period, date: day, schoolId: sid });
  return { date: day, subject, period, marks: saved };
}

/**
 * Attendance history + simple stats for one student. Available to the
 * student themself, any teacher, or the school. Caller (controller) is
 * responsible for enforcing the "self only" restriction for STUDENT role.
 */
export async function getStudentHistory(schoolId, studentSlug, { from, to } = {}) {
  const sid = targetSchoolId(schoolId);
  const student = await Student.findOne({ slug: studentSlug, schoolId: sid });
  if (!student) throw new AppError("Student not found", 404);

  const query = { studentId: student._id, schoolId: sid };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = normalizeToDay(from);
    if (to) query.date.$lte = normalizeToDay(to);
  }

  const records = await Attendance.find(query).sort({ date: -1, period: 1 });

  const total = records.length;
  const counts = { present: 0, absent: 0, late: 0, "not-marked": 0 };
  for (const r of records) counts[r.status] = (counts[r.status] || 0) + 1;

  const attendancePct = total ? Math.round((counts.present / total) * 1000) / 10 : 0;

  return {
    student: {
      id: student._id,
      slug: student.slug,
      name: `${student.firstName} ${student.lastName}`.trim(),
      rollNumber: student.rollNumber,
    },
    stats: { total, ...counts, attendancePct },
    records,
  };
}

/**
 * Present/absent/late/not-marked counts for a section on a given day —
 * powers AttendanceSummaryPanel. "not-marked" is computed against the full
 * active roster, not just rows that happen to exist in Attendance, so a
 * completely unmarked day still reports the right total.
 */
export async function getSectionDaySummary(schoolId, { sectionId, date }) {
  const sid = targetSchoolId(schoolId);
  const section = await Section.findOne({ _id: sectionId, schoolId: sid });
  if (!section) throw new AppError("Section not found", 404);

  const day = normalizeToDay(date);
  const students = await Student.find({ sectionId, schoolId: sid, status: "ACTIVE" }).select("_id");
  const total = students.length;

  const records = await Attendance.find({ sectionId, schoolId: sid, date: day });

  // A student may have several period records in a day; take the "worst"
  // status per student for a single daily summary — present only if present
  // in every marked period, otherwise reflect absent/late.
  const priority = { absent: 3, late: 2, present: 1, "not-marked": 0 };
  const perStudent = new Map();
  for (const r of records) {
    const key = String(r.studentId);
    const current = perStudent.get(key);
    if (!current || priority[r.status] > priority[current]) {
      perStudent.set(key, r.status);
    }
  }

  const counts = { present: 0, absent: 0, late: 0, "not-marked": 0 };
  for (const s of students) {
    const status = perStudent.get(String(s._id)) || "not-marked";
    counts[status] += 1;
  }

  return { sectionId, date: day, total, ...counts };
}

/**
 * Daily school-wide attendance % across a date range — powers AttendanceChart
 * on the Principal dashboard. SCHOOL role only (read-only, enforced at the
 * controller/route level since this service has no mark path at all).
 */
export async function getSchoolTrend(schoolId, { from, to } = {}) {
  const sid = targetSchoolId(schoolId);

  const match = { schoolId: sid };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = normalizeToDay(from);
    if (to) match.date.$lte = normalizeToDay(to);
  }

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$date",
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    date: r._id,
    total: r.total,
    present: r.present,
    attendancePct: r.total ? Math.round((r.present / r.total) * 1000) / 10 : 0,
  }));
}

/**
 * Today's attendance summary across every section the logged-in teacher is
 * assigned to (one row per distinct section, not per subject) — powers the
 * teacher-side AttendanceSummary widget in Academics without requiring N
 * separate frontend calls.
 */
export async function getMyTodaySummaries(schoolId, teacherUserId) {
  const sid = targetSchoolId(schoolId);
  const teacher = await resolveTeacher(sid, teacherUserId);

  const assignments = await TeacherAssignment.find({
    teacherId: teacher._id,
    schoolId: sid,
    isActive: true,
  }).populate("sectionId", "gradeClass section");

  const seenSections = new Map();
  for (const a of assignments) {
    if (a.sectionId && !seenSections.has(String(a.sectionId._id))) {
      seenSections.set(String(a.sectionId._id), { section: a.sectionId, subjects: [a.subjects[0]] });
    } else if (a.sectionId) {
      seenSections.get(String(a.sectionId._id)).subjects.push(a.subjects[0]);
    }
  }

  const today = normalizeToDay(new Date());

  return Promise.all(
    Array.from(seenSections.values()).map(async ({ section, subjects }) => {
      const summary = await getSectionDaySummary(sid, { sectionId: section._id, date: today });
      return {
        sectionId: section._id,
        classSection: `${section.gradeClass} - ${section.section}`,
        subject: subjects[0], // representative subject for display
        present: summary.present,
        total: summary.total,
      };
    })
  );
}

/**
 * School-wide snapshot for the Principal dashboard's top metric cards
 * (Total Teachers, Present Teachers, Total Students, Avg Attendance).
 * "Present today" is derived the same way as getSectionDaySummary: the
 * worst status across a person's marked records for the day, defaulting to
 * "not-marked" if nothing was recorded. Teacher presence has no Attendance
 * rows of its own (only students are marked) — so it's reported as
 * "marked sections today" instead of a literal present/absent count, since
 * this schema has no teacher-attendance concept yet.
 */
export async function getSchoolStats(schoolId) {
  const sid = targetSchoolId(schoolId);
  const today = normalizeToDay(new Date());

  const [totalTeachers, totalStudents, totalSections] = await Promise.all([
    Teacher.countDocuments({ schoolId: sid, status: "ACTIVE" }),
    Student.countDocuments({ schoolId: sid, status: "ACTIVE" }),
    Section.countDocuments({ schoolId: sid, isActive: true }),
  ]);

  // Distinct teachers who have marked at least one attendance record today —
  // the closest honest proxy for "active/present today" without a real
  // teacher check-in system.
  const teachersMarkedTodayIds = await Attendance.distinct("markedBy", {
    schoolId: sid,
    date: today,
  });

  // School-wide average attendance %, over the last 7 marked days
  // (present / total across all Attendance rows in that window).
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const [weekAgg] = await Attendance.aggregate([
    { $match: { schoolId: sid, date: { $gte: sevenDaysAgo, $lte: today } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      },
    },
  ]);

  const avgAttendancePct =
    weekAgg && weekAgg.total ? Math.round((weekAgg.present / weekAgg.total) * 1000) / 10 : 0;

  return {
    totalTeachers,
    totalStudents,
    totalSections,
    teachersMarkedToday: teachersMarkedTodayIds.length,
    avgAttendancePct7d: avgAttendancePct,
  };
}

/**
 * Every active section in the school with its roster size and today's
 * marked/present counts — powers the Principal's class/section drill-down
 * list (click a section to open its day summary + roster).
 */
export async function getSchoolSections(schoolId) {
  const sid = targetSchoolId(schoolId);
  const today = normalizeToDay(new Date());

  const sections = await Section.find({ schoolId: sid, isActive: true })
    .populate("classTeacherId", "firstName lastName")
    .sort({ gradeClass: 1, section: 1 });

  return Promise.all(
    sections.map(async (section) => {
      const [totalStudents, summary] = await Promise.all([
        Student.countDocuments({ sectionId: section._id, schoolId: sid, status: "ACTIVE" }),
        getSectionDaySummary(sid, { sectionId: section._id, date: today }),
      ]);
      return {
        sectionId: section._id,
        slug: section.slug,
        gradeClass: section.gradeClass,
        section: section.section,
        classTeacher: section.classTeacherId
          ? `${section.classTeacherId.firstName} ${section.classTeacherId.lastName}`.trim()
          : null,
        totalStudents,
        today: {
          present: summary.present,
          absent: summary.absent,
          late: summary.late,
          notMarked: summary["not-marked"],
        },
      };
    })
  );
}

/**
 * Full active student roster for one section with each student's
 * term-to-date attendance % — powers the drill-down view under a section
 * (Principal browsing, or a Teacher viewing one of their own sections).
 * Reuses computeOverallAttendancePct so the % here matches what the
 * marking grid shows.
 */
export async function getSectionRoster(schoolId, sectionId) {
  const sid = targetSchoolId(schoolId);
  const section = await Section.findOne({ _id: sectionId, schoolId: sid, isActive: true });
  if (!section) throw new AppError("Section not found", 404);

  const students = await Student.find({ sectionId, schoolId: sid, status: "ACTIVE" }).sort({
    rollNumber: 1,
  });

  const overallPctByStudentId = await computeOverallAttendancePct(
    sid,
    students.map((s) => s._id)
  );

  const roster = students.map((s) => ({
    studentId: s._id,
    slug: s.slug,
    rollNumber: s.rollNumber,
    name: `${s.firstName} ${s.lastName}`.trim(),
    overallAttendancePct: overallPctByStudentId.get(String(s._id)) ?? 100,
  }));

  return { section, roster };
}

/**
 * Self-service version of getStudentHistory — resolves the logged-in
 * STUDENT's own Student profile from their userId, so the frontend never
 * needs to know its own slug just to view its own attendance. Mirrors the
 * getMyAssignments / getMyLeaves self-service pattern used elsewhere.
 */
export async function getMyAttendanceHistory(schoolId, studentUserId, { from, to } = {}) {
  const sid = targetSchoolId(schoolId);
  const student = await Student.findOne({ userId: studentUserId, schoolId: sid });
  if (!student) throw new AppError("Student profile not found", 404);

  return getStudentHistory(sid, student.slug, { from, to });
}