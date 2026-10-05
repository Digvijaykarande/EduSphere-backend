import mongoose from "mongoose";

const studyDiaryEntrySchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    // Free-text duration string (e.g. "1h 20m") — matches the frontend's
    // input pattern rather than forcing structured hours/minutes fields.
    duration: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

studyDiaryEntrySchema.index({ studentId: 1, createdAt: -1 });

export default mongoose.models.StudyDiaryEntry ||
  mongoose.model("StudyDiaryEntry", studyDiaryEntrySchema);
