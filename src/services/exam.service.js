import AppError from "../utils/AppError.js";
import Exam from "../models/Exam.js";
import ExamResult from "../models/ExamResult.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import { computeDuration, computeResult } from "../utils/grading.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

/**
 * A teacher may create/grade an exam for a given section+subject only if
 * they hold an active TeacherAssignment covering that pair — same rule the
 * attendance module uses via assertTeacherCanMark. Principals bypass this.
 */
async function assertTeacherCanOwnExam({ schoolId, userId, sectionIds, subject }) {
  const teacher = await Teacher.findOne({ userId, schoolId });
  if (!teacher) throw new AppError("Teacher profile not found", 404);

  const assignments = await TeacherAssignment.find({
    teacherId: teacher._id,
    schoolId,
    sectionId: { $in: sectionIds },
    subjects: subject,
    isActive: true,
  });

  const coveredSectionIds = new Set(assignments.map((a) => String(a.sectionId)));
  const missing = sectionIds.filter((id) => !coveredSectionIds.has(String(id)));

  if (missing.length > 0) {
    throw new AppError(
      "You are not assigned to teach this subject for one or more of the selected sections",
      403
    );
  }

  return teacher;
}

async function resolveSections(schoolId, sectionIds) {
  const sections = await Section.find({
    _id: { $in: sectionIds },
    schoolId,
    isActive: true,
  });
  if (sections.length !== sectionIds.length) {
    throw new AppError("One or more sections were not found or are inactive", 400);
  }
  return sections;
}

/**
 * Creates all ExamResult placeholder rows for every student across the
 * exam's sections, so the gradebook / results queue can immediately show
 * "0 entered / N total" without a separate seeding step later.
 */
async function seedResultRows(schoolId, exam) {
  const students = await Student.find({
    schoolId,
    sectionId: { $in: exam.sections },
    status: "ACTIVE",
  }).select("_id sectionId");

  if (students.length === 0) return;

  const rows = students.map((s) => ({
    schoolId,
    examId: exam._id,
    studentId: s._id,
    sectionId: s.sectionId,
  }));

  await ExamResult.insertMany(rows, { ordered: false }).catch((err) => {
    // Ignore duplicate-key races (E11000) from concurrent seeding; anything
    // else should surface.
    if (err?.code !== 11000) throw err;
  });
}

export async function createExam(schoolId, userId, isTeacherActor, data) {
  const sid = targetSchoolId(schoolId);
  await resolveSections(sid, data.sectionIds);

  if (isTeacherActor) {
    await assertTeacherCanOwnExam({
      schoolId: sid,
      userId,
      sectionIds: data.sectionIds,
      subject: data.subject,
    });
  }

  const slug = await Exam.generateUniqueExamSlug();
  const duration = computeDuration(data.startTime, data.endTime);

  const exam = await Exam.create({
    slug,
    schoolId: sid,
    title: data.title,
    subject: data.subject,
    type: data.type,
    sections: data.sectionIds,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    room: data.room,
    duration,
    maxMarks: data.maxMarks,
    passingMarks: data.passingMarks,
    weightage: data.weightage,
    instructions: data.instructions,
    createdBy: userId,
  });

  await seedResultRows(sid, exam);

  return Exam.findById(exam._id).populate("sections", "gradeClass section slug");
}

export async function getExams(schoolId, { search, status, subject, sectionId, page = 1, limit = 20 }) {
  const sid = targetSchoolId(schoolId);
  const query = { schoolId: sid };

  if (status && status !== "All") query.status = status;
  if (subject) query.subject = subject;
  if (sectionId) query.sections = sectionId;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [exams, total] = await Promise.all([
    Exam.find(query)
      .populate("sections", "gradeClass section slug")
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit),
    Exam.countDocuments(query),
  ]);

  return {
    exams,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getExamBySlug(schoolId, slug) {
  const sid = targetSchoolId(schoolId);
  const exam = await Exam.findOne({ slug, schoolId: sid }).populate(
    "sections",
    "gradeClass section slug"
  );
  if (!exam) throw new AppError("Exam not found", 404);
  return exam;
}

async function loadOwnedExam(schoolId, examIdOrSlug, { userId, isTeacherActor } = {}) {
  const sid = targetSchoolId(schoolId);
  const isObjectId = /^[a-f\d]{24}$/i.test(examIdOrSlug);
  const exam = await Exam.findOne({
    schoolId: sid,
    ...(isObjectId ? { _id: examIdOrSlug } : { slug: examIdOrSlug }),
  });
  if (!exam) throw new AppError("Exam not found", 404);

  if (isTeacherActor) {
    await assertTeacherCanOwnExam({
      schoolId: sid,
      userId,
      sectionIds: exam.sections,
      subject: exam.subject,
    });
  }

  return exam;
}

export async function updateExam(schoolId, examId, actor, patch) {
  const sid = targetSchoolId(schoolId);
  const exam = await loadOwnedExam(sid, examId, actor);

  if (patch.sectionIds) {
    await resolveSections(sid, patch.sectionIds);
    exam.sections = patch.sectionIds;
    delete patch.sectionIds;
  }

  if (patch.startTime || patch.endTime) {
    const startTime = patch.startTime || exam.startTime;
    const endTime = patch.endTime || exam.endTime;
    exam.duration = computeDuration(startTime, endTime);
  }

  Object.assign(exam, patch);
  await exam.save();
  return exam.populate("sections", "gradeClass section slug");
}

export async function deleteExam(schoolId, examId, actor) {
  const sid = targetSchoolId(schoolId);
  const exam = await loadOwnedExam(sid, examId, actor);

  await Promise.all([
    ExamResult.deleteMany({ examId: exam._id }),
    exam.deleteOne(),
  ]);

  return { message: "Exam deleted successfully" };
}

// ---------------------------------------------------------------------------
// Marks entry / gradebook
// ---------------------------------------------------------------------------

export async function getGradebook(schoolId, examId, actor, { sectionId, search, page = 1, limit = 10 }) {
  const sid = targetSchoolId(schoolId);
  const exam = await loadOwnedExam(sid, examId, actor);

  const query = { examId: exam._id, schoolId: sid };
  if (sectionId) query.sectionId = sectionId;

  let studentFilter = {};
  if (search) {
    studentFilter = {
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
      ],
    };
  }

  const skip = (page - 1) * limit;

  const results = await ExamResult.find(query)
    .populate({
      path: "studentId",
      select: "firstName lastName rollNumber slug",
      match: studentFilter,
    })
    .populate("sectionId", "gradeClass section slug")
    .sort({ createdAt: 1 });

  // Filter out rows whose populated studentId came back null (search miss).
  const filtered = results.filter((r) => r.studentId !== null);
  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    exam: {
      id: exam._id,
      slug: exam.slug,
      title: exam.title,
      subject: exam.subject,
      maxMarks: exam.maxMarks,
      passingMarks: exam.passingMarks,
    },
    results: paginated,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function saveMarks(schoolId, examId, actor, entries) {
  const sid = targetSchoolId(schoolId);
  const exam = await loadOwnedExam(sid, examId, actor);

  const ops = entries.map(({ studentId, marksObtained }) => {
    const { grade, isPassed } = computeResult({
      marksObtained,
      maxMarks: exam.maxMarks,
      passingMarks: exam.passingMarks,
    });

    return {
      updateOne: {
        filter: { examId: exam._id, studentId },
        update: {
          $set: {
            marksObtained,
            grade,
            isPassed,
            enteredBy: actor.userId,
            enteredAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  await ExamResult.bulkWrite(ops);

  // Flip the exam's aggregate resultsStatus based on entry completeness.
  const [total, entered] = await Promise.all([
    ExamResult.countDocuments({ examId: exam._id }),
    ExamResult.countDocuments({ examId: exam._id, marksObtained: { $ne: null } }),
  ]);

  if (exam.resultsStatus !== "Published") {
    exam.resultsStatus = entered === 0 ? "Not Started" : "Processing";
    await exam.save();
  }

  return { total, entered };
}

// ---------------------------------------------------------------------------
// Results pipeline (publish)
// ---------------------------------------------------------------------------

export async function getResultsQueue(schoolId) {
  const sid = targetSchoolId(schoolId);
  const exams = await Exam.find({ schoolId: sid }).populate(
    "sections",
    "gradeClass section slug"
  );

  const rows = await Promise.all(
    exams.map(async (exam) => {
      const [total, entered] = await Promise.all([
        ExamResult.countDocuments({ examId: exam._id }),
        ExamResult.countDocuments({ examId: exam._id, marksObtained: { $ne: null } }),
      ]);
      return {
        id: exam.slug,
        title: exam.title,
        subject: exam.subject,
        class: exam.sections.map((s) => `${s.gradeClass}-${s.section}`).join(", "),
        date: exam.date,
        entered,
        total,
        status: exam.resultsStatus,
      };
    })
  );

  return rows;
}

export async function publishResults(schoolId, examId, actor) {
  const sid = targetSchoolId(schoolId);
  const exam = await loadOwnedExam(sid, examId, actor);

  const [total, entered] = await Promise.all([
    ExamResult.countDocuments({ examId: exam._id }),
    ExamResult.countDocuments({ examId: exam._id, marksObtained: { $ne: null } }),
  ]);

  if (total === 0 || entered < total) {
    throw new AppError("All marks must be entered before publishing results", 400);
  }

  exam.resultsStatus = "Published";
  exam.status = "Completed";
  exam.publishedAt = new Date();
  await exam.save();

  await ExamResult.updateMany({ examId: exam._id }, { $set: { isPublished: true } });

  return exam;
}

// ---------------------------------------------------------------------------
// Overview / stats / analytics
// ---------------------------------------------------------------------------

export async function getExamStats(schoolId) {
  const sid = targetSchoolId(schoolId);
  const [totalExams, upcomingExams, completedExams, scoreAgg] = await Promise.all([
    Exam.countDocuments({ schoolId: sid }),
    Exam.countDocuments({ schoolId: sid, status: "Upcoming" }),
    Exam.countDocuments({ schoolId: sid, status: "Completed" }),
    ExamResult.aggregate([
      { $match: { schoolId: sid, marksObtained: { $ne: null } } },
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "exam",
        },
      },
      { $unwind: "$exam" },
      {
        $group: {
          _id: null,
          avgPct: {
            $avg: { $multiply: [{ $divide: ["$marksObtained", "$exam.maxMarks"] }, 100] },
          },
          passCount: { $sum: { $cond: ["$isPassed", 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const agg = scoreAgg[0] || { avgPct: 0, passCount: 0, total: 0 };
  const averageScore = agg.total ? `${agg.avgPct.toFixed(1)}%` : "0%";
  const passPercentage = agg.total ? `${((agg.passCount / agg.total) * 100).toFixed(1)}%` : "0%";

  return { totalExams, upcomingExams, completedExams, averageScore, passPercentage };
}

export async function getUpcomingExams(schoolId, limitCount = 5) {
  const sid = targetSchoolId(schoolId);
  const exams = await Exam.find({ schoolId: sid, status: "Upcoming" })
    .populate("sections", "gradeClass section slug")
    .sort({ date: 1 })
    .limit(limitCount);

  return exams.map((e) => ({
    id: e.slug,
    subject: e.subject,
    test: e.title,
    date: e.date,
    class: e.sections.map((s) => `${s.gradeClass}-${s.section}`).join(", "),
  }));
}

export async function getRecentResults(schoolId, limitCount = 5) {
  const sid = targetSchoolId(schoolId);
  const exams = await Exam.find({ schoolId: sid, resultsStatus: { $ne: "Not Started" } })
    .populate("sections", "gradeClass section slug")
    .sort({ date: -1 })
    .limit(limitCount);

  return exams.map((e) => ({
    id: e.slug,
    subject: e.subject,
    test: e.title,
    date: e.date,
    class: e.sections.map((s) => `${s.gradeClass}-${s.section}`).join(", "),
    status: e.resultsStatus === "Published" ? "Published" : "Processing",
  }));
}

export async function getTopPerformers(schoolId, limitCount = 5) {
  const sid = targetSchoolId(schoolId);
  const rows = await ExamResult.aggregate([
    { $match: { schoolId: sid, isPublished: true, marksObtained: { $ne: null } } },
    {
      $lookup: {
        from: "exams",
        localField: "examId",
        foreignField: "_id",
        as: "exam",
      },
    },
    { $unwind: "$exam" },
    {
      $group: {
        _id: "$studentId",
        avgPct: {
          $avg: { $multiply: [{ $divide: ["$marksObtained", "$exam.maxMarks"] }, 100] },
        },
      },
    },
    { $sort: { avgPct: -1 } },
    { $limit: limitCount },
    {
      $lookup: {
        from: "students",
        localField: "_id",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    {
      $lookup: {
        from: "sections",
        localField: "student.sectionId",
        foreignField: "_id",
        as: "section",
      },
    },
    { $unwind: { path: "$section", preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((r, idx) => ({
    id: idx + 1,
    name: `${r.student.firstName} ${r.student.lastName}`,
    class: r.section ? `${r.section.gradeClass}-${r.section.section}` : "",
    score: `${r.avgPct.toFixed(1)}%`,
  }));
}

export async function getAtRiskStudents(schoolId, threshold = 50, limitCount = 8) {
  const sid = targetSchoolId(schoolId);
  const rows = await ExamResult.aggregate([
    { $match: { schoolId: sid, marksObtained: { $ne: null } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$studentId",
        latest: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$latest" } },
    {
      $lookup: {
        from: "exams",
        localField: "examId",
        foreignField: "_id",
        as: "exam",
      },
    },
    { $unwind: "$exam" },
    {
      $addFields: {
        pct: { $multiply: [{ $divide: ["$marksObtained", "$exam.maxMarks"] }, 100] },
      },
    },
    { $match: { pct: { $lt: threshold } } },
    { $sort: { pct: 1 } },
    { $limit: limitCount },
    {
      $lookup: {
        from: "students",
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    {
      $lookup: {
        from: "sections",
        localField: "sectionId",
        foreignField: "_id",
        as: "section",
      },
    },
    { $unwind: { path: "$section", preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((r) => ({
    id: r.student._id,
    name: `${r.student.firstName} ${r.student.lastName}`,
    class: r.section ? `${r.section.gradeClass}-${r.section.section}` : "",
    subject: r.exam.subject,
    score: Math.round(r.pct),
    trend: "down",
  }));
}

export async function getAnalytics(schoolId) {
  const sid = targetSchoolId(schoolId);

  const [gradeDistribution, subjectPerformance, classComparison] = await Promise.all([
    // Grade distribution across all published results.
    ExamResult.aggregate([
      { $match: { schoolId: sid, isPublished: true, grade: { $ne: null } } },
      { $group: { _id: "$grade", count: { $sum: 1 } } },
    ]),

    // Subject-wise average score.
    ExamResult.aggregate([
      { $match: { schoolId: sid, marksObtained: { $ne: null } } },
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "exam",
        },
      },
      { $unwind: "$exam" },
      {
        $group: {
          _id: "$exam.subject",
          average: {
            $avg: { $multiply: [{ $divide: ["$marksObtained", "$exam.maxMarks"] }, 100] },
          },
        },
      },
    ]),

    // Class (section) comparison: average score + pass rate.
    ExamResult.aggregate([
      { $match: { schoolId: sid, marksObtained: { $ne: null } } },
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "exam",
        },
      },
      { $unwind: "$exam" },
      {
        $lookup: {
          from: "sections",
          localField: "sectionId",
          foreignField: "_id",
          as: "section",
        },
      },
      { $unwind: "$section" },
      {
        $group: {
          _id: "$sectionId",
          className: { $first: { $concat: ["$section.gradeClass", "-", "$section.section"] } },
          average: {
            $avg: { $multiply: [{ $divide: ["$marksObtained", "$exam.maxMarks"] }, 100] },
          },
          passCount: { $sum: { $cond: ["$isPassed", 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const gradeOrder = ["A+", "A", "B", "C", "D", "F"];
  const gradeMap = Object.fromEntries(gradeDistribution.map((g) => [g._id, g.count]));

  return {
    gradeDistribution: gradeOrder.map((g) => ({ group: g, count: gradeMap[g] || 0 })),
    subjectPerformance: subjectPerformance.map((s) => ({
      subject: s._id,
      average: Math.round(s.average),
    })),
    classComparison: classComparison.map((c) => ({
      class: c.className,
      average: Math.round(c.average),
      passRate: c.total ? Math.round((c.passCount / c.total) * 100) : 0,
    })),
    atRiskStudents: await getAtRiskStudents(sid),
  };
}

// ---------------------------------------------------------------------------
// Student-facing views
// ---------------------------------------------------------------------------

export async function getStudentExamOverview(schoolId, studentUserId) {
  const sid = targetSchoolId(schoolId);
  const student = await Student.findOne({ userId: studentUserId, schoolId: sid });
  if (!student) throw new AppError("Student profile not found", 404);

  const [upcomingExams, results, stats] = await Promise.all([
    Exam.find({
      schoolId: sid,
      sections: student.sectionId,
      status: "Upcoming",
    })
      .sort({ date: 1 })
      .limit(10),

    ExamResult.find({
      schoolId: sid,
      studentId: student._id,
      isPublished: true,
    }).populate("examId", "title subject maxMarks date"),

    getExamStats(sid),
  ]);

  const reportCard = results
    .filter((r) => r.examId)
    .map((r) => ({
      subject: r.examId.subject,
      score: r.marksObtained,
      grade: r.grade,
    }));

  const timetable = upcomingExams.map((e) => ({
    subject: e.title === e.subject ? e.subject : `${e.subject} (${e.title})`,
    date: e.date,
    time: `${e.startTime} – ${e.endTime}`,
    room: e.room,
    status: e.status,
  }));

  return {
    stats,
    upcomingExams: upcomingExams.map((e) => ({
      id: e.slug,
      subject: e.subject,
      test: e.title,
      date: e.date,
      class: "",
    })),
    recentResults: reportCard.slice(0, 5).map((r, idx) => ({
      id: results[idx]?.examId?._id,
      subject: r.subject,
      test: r.subject,
      date: results[idx]?.examId?.date,
      status: "Published",
    })),
    examTimetable: timetable,
    studentReportCard: reportCard,
  };
}
