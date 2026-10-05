import mongoose from "mongoose";

const submissionAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    originalSize: { type: Number, default: 0 },
    type: { type: String, default: "" },
  },
  { _id: false }
);

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED", "GRADED"],
      default: "IN_PROGRESS",
    },
    attachments: {
      type: [submissionAttachmentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    marks: {
      type: String,
      default: "",
    },
    feedback: {
      type: String,
      default: "",
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One submission row per student per assignment — created lazily (on first
// view or first file attach) rather than pre-seeded for the whole roster,
// so "0/45" style counts are simply a count of SUBMITTED/GRADED rows,
// not a count against pre-created placeholders.
assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export default mongoose.models.AssignmentSubmission ||
  mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
