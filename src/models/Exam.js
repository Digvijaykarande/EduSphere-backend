import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const examSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Theory", "Practical", "Oral", "Project"],
      default: "Theory",
    },
    // Sections this exam applies to (by slug string, matching frontend's
    // "10-A" style labels used across CreateExamModal / AllExamsList).
    sections: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Section",
        },
      ],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one section is required",
      },
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String, // "HH:mm"
      required: true,
    },
    endTime: {
      type: String, // "HH:mm"
      required: true,
    },
    room: {
      type: String,
      default: "",
      trim: true,
    },
    duration: {
      // Denormalized human-readable duration, derived from start/end at
      // creation time so the frontend list views don't need to recompute it.
      type: String,
      default: "",
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    passingMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    weightage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    instructions: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Upcoming", "Completed", "Cancelled"],
      default: "Upcoming",
    },
    syllabusCoverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    questionPaperStatus: {
      type: String,
      enum: ["Pending", "Draft", "Uploaded"],
      default: "Pending",
    },
    questionPaperUrl: {
      type: String,
      default: "",
    },
    resultsStatus: {
      // Not Started -> Processing (some marks entered) -> Published
      type: String,
      enum: ["Not Started", "Processing", "Published"],
      default: "Not Started",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      // The User who created this exam — principal, or a teacher acting on
      // a TeacherAssignment-backed subject/section.
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

examSchema.index({ schoolId: 1, date: 1 });
examSchema.index({ schoolId: 1, status: 1 });
examSchema.index({ schoolId: 1, subject: 1 });

examSchema.statics.generateUniqueExamSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("exm") });
    if (!exists) return generateSlug("exm");
  }
  return generateSlug("exm") + generateSlug("exm").slice(4);
};

export default mongoose.models.Exam || mongoose.model("Exam", examSchema);
