import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const teacherSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    phone: {
      type: String,
      default: "",
    },
    qualification: {
      type: String,
      default: "",
    },
    experience: {
      type: Number,
      default: 0,
    },
    subjects: {
      type: [String],
      default: [],
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

teacherSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true });

teacherSchema.statics.generateUniqueTeacherSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("tch") });
    if (!exists) return generateSlug("tch");
  }
  return generateSlug("tch") + generateSlug("tch").slice(4);
};

export default mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);
