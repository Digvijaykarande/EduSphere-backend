import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    // Size before Cloudinary's compression transform was applied (images,
    // PDFs). 0/absent for raw files that were never compressed.
    originalSize: { type: Number, default: 0 },
    type: { type: String, default: "" },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
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
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    // The teacher who created this — must hold a TeacherAssignment for
    // (sectionId, subject), same authorization pattern as attendance marking.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    // Reference material the teacher attaches (instructions, worksheets) —
    // distinct from a student's submission attachments, stored separately
    // on AssignmentSubmission.
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ schoolId: 1, sectionId: 1, dueDate: 1 });

assignmentSchema.statics.generateUniqueAssignmentSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("asg") });
    if (!exists) return generateSlug("asg");
  }
  return generateSlug("asg") + generateSlug("asg").slice(4);
};

export default mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);
