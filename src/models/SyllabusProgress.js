import mongoose from "mongoose";

const syllabusProgressSchema = new mongoose.Schema(
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
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    // The teacher maintaining this subject's progress — must hold a
    // TeacherAssignment for (sectionId, subject), same pattern as
    // attendance/assignments.
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    progressPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    currentUnit: {
      type: String,
      default: "",
      trim: true,
    },
    color: {
      type: String,
      default: "#6366f1",
    },
  },
  { timestamps: true }
);

// One progress row per section+subject.
syllabusProgressSchema.index({ sectionId: 1, subject: 1 }, { unique: true });

export default mongoose.models.SyllabusProgress ||
  mongoose.model("SyllabusProgress", syllabusProgressSchema);
