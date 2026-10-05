import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";
import { STAFF_TYPES } from "./constants.js";

const staffSchema = new mongoose.Schema(
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
    staffType: {
      type: String,
      enum: Object.values(STAFF_TYPES),
      required: true,
      index: true,
    },
    // Free-text label used only when staffType === "OTHER", e.g. "Groundskeeper".
    customTitle: {
      type: String,
      default: "",
      trim: true,
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
    // Which department/section they support, e.g. "Library", "Science Lab".
    department: {
      type: String,
      default: "",
      trim: true,
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

staffSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true });

staffSchema.statics.generateUniqueStaffSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("stf") });
    if (!exists) return generateSlug("stf");
  }
  return generateSlug("stf") + generateSlug("stf").slice(4);
};

export default mongoose.models.Staff || mongoose.model("Staff", staffSchema);
