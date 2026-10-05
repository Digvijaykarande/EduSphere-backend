import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";
import { ATTENDANCE_STATUSES } from "./attendance.constants.js";

const attendanceSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    period: {
      type: String,
      required: true,
      trim: true,
    },
    // Normalized to midnight UTC for the calendar day — see normalizeToDay()
    // in attendance.service.js. Never store a time-of-day component here.
    date: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: "not-marked",
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// One record per student, per subject, per period, per day. This is the
// upsert key used by markAttendance — re-marking the same slot updates in
// place rather than creating duplicates.
attendanceSchema.index(
  { studentId: 1, sectionId: 1, subject: 1, period: 1, date: 1 },
  { unique: true }
);

// Supports section-day summary queries and school-wide trend aggregation.
attendanceSchema.index({ schoolId: 1, sectionId: 1, date: 1 });
attendanceSchema.index({ schoolId: 1, date: 1 });

attendanceSchema.statics.generateUniqueAttendanceSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("att") });
    if (!exists) return generateSlug("att");
  }
  return generateSlug("att") + generateSlug("att").slice(4);
};

export default mongoose.models.Attendance ||
  mongoose.model("Attendance", attendanceSchema);
