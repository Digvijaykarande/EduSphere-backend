import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const studentSchema = new mongoose.Schema(
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
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      default: "",
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    motherName: {
      type: String,
      default: "",
      trim: true,
    },
    // Denormalized display strings — kept in sync with sectionId's own
    // gradeClass/section whenever the student is (re)assigned to a Section.
    gradeClass: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      default: "A",
      trim: true,
    },
    // Source of truth for roster scoping, attendance, and leave-approval
    // routing. Nullable during the transition period before every student
    // has been linked to a real Section document.
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
      index: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    dateOfBirth: {
      type: Date,
    },
    parentName: {
      type: String,
      default: "",
    },
    parentEmail: {
      type: String,
      default: "",
    },
    parentPhone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    assignedTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

studentSchema.index({ schoolId: 1, rollNumber: 1 }, { unique: true });

studentSchema.statics.generateUniqueStudentSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("stu") });
    if (!exists) return generateSlug("stu");
  }
  return generateSlug("stu") + generateSlug("stu").slice(4);
};

export default mongoose.models.Student || mongoose.model("Student", studentSchema);
