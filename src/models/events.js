// src/models/events.js
import mongoose from "mongoose";

export const CATEGORY_OPTIONS = ["School Event", "Exam", "Meeting", "Holiday", "Other"];

const eventSchema = new mongoose.Schema(
  {
    // Multi-tenant scoping — every event belongs to exactly one school.
    // ADJUST: rename `school` / ref if your Teacher/Student models use a
    // different field name (e.g. `schoolId`).
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // Stored as "YYYY-MM-DD" (not a Date) on purpose — matches the
    // frontend's toKey() format exactly and avoids UTC/local timezone
    // shifting the calendar day when the value round-trips through JSON.
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    // Free text to match the frontend inputs (e.g. "10:00 AM", "All day").
    start: {
      type: String,
      required: true,
      trim: true,
      default: "All day",
    },
    end: {
      type: String,
      trim: true,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      default: "TBD",
    },

    category: {
      type: String,
      enum: CATEGORY_OPTIONS,
      required: true,
      default: "Other",
    },

    // Only meaningful when category === "Other" — the manually typed
    // label the user enters instead of the generic "Other" tag.
    customCategoryLabel: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

eventSchema.index({ school: 1, date: 1 });

// Convenience virtual: what the frontend should actually display as the
// category badge/label (falls back to "Other" if no custom label given).
eventSchema.virtual("displayCategory").get(function () {
  return this.category === "Other" && this.customCategoryLabel
    ? this.customCategoryLabel
    : this.category;
});

eventSchema.set("toJSON", { virtuals: true });

const Event = mongoose.model("Event", eventSchema);

export default Event;