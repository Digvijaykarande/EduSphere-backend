import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const leaveRequestSchema = new mongoose.Schema(
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
    // The User this leave is for. Role-model lookup (Student/Teacher) is
    // resolved via applicantRole at read/write time rather than storing a
    // second polymorphic ref, keeping this schema simple.
    applicantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    applicantRole: {
      type: String,
      enum: ["STUDENT", "TEACHER"],
      required: true,
    },
    // Only set for STUDENT leaves — drives routing to the correct class
    // teacher for approval. Null for TEACHER leaves (those go to SCHOOL).
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
      index: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED"],
      default: "PENDING",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewerNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ schoolId: 1, applicantRole: 1, status: 1 });
leaveRequestSchema.index({ applicantUserId: 1, createdAt: -1 });

leaveRequestSchema.statics.generateUniqueLeaveSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("lve") });
    if (!exists) return generateSlug("lve");
  }
  return generateSlug("lve") + generateSlug("lve").slice(4);
};

export default mongoose.models.LeaveRequest ||
  mongoose.model("LeaveRequest", leaveRequestSchema);
