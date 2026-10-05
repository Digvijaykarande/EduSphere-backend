import mongoose from "mongoose";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_TYPES = ["class", "lab", "planning"];

const timetableSlotSchema = new mongoose.Schema(
  {
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
    day: {
      type: String,
      enum: DAYS,
      required: true,
    },
    // Free-text period label, matching the frontend's PERIODS constant
    // (e.g. "1st Period (09:00 AM - 09:45 AM)") — kept as a string rather
    // than a separate Period model so it stays in sync with attendance's
    // period labels without a second source of truth.
    period: {
      type: String,
      required: true,
    },
    // Parsed start time for "what's happening now" / ongoing-period logic
    // on the frontend, stored as minutes-from-midnight to avoid timezone
    // parsing issues with a Date type for a recurring weekly slot.
    startMinutes: {
      type: Number,
      required: true,
    },
    durationMinutes: {
      type: Number,
      default: 45,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    room: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: SLOT_TYPES,
      default: "class",
    },
    topic: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// One slot per section, per day, per period — prevents double-booking a
// section's timetable grid cell.
timetableSlotSchema.index({ sectionId: 1, day: 1, period: 1 }, { unique: true });
timetableSlotSchema.index({ teacherId: 1, day: 1 });

export const TIMETABLE_DAYS = DAYS;

export default mongoose.models.TimetableSlot ||
  mongoose.model("TimetableSlot", timetableSlotSchema);
