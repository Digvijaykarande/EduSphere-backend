import mongoose from "mongoose";

const examResultSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    marksObtained: {
      type: Number,
      default: null,
      min: 0,
    },
    grade: {
      // A+ / A / B / C / D / F — derived from marksObtained vs exam.maxMarks
      type: String,
      default: null,
    },
    isPassed: {
      type: Boolean,
      default: null,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    enteredAt: {
      type: Date,
      default: null,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One result row per (exam, student).
examResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
examResultSchema.index({ schoolId: 1, sectionId: 1, examId: 1 });

export default mongoose.models.ExamResult ||
  mongoose.model("ExamResult", examResultSchema);
