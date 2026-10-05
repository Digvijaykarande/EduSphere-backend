import mongoose from "mongoose";

const teacherAssignmentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    // Subjects this teacher is assigned to teach *for this section*.
    // e.g. a teacher may teach Math+Science for 10-A and only History for 9-B
    // — each is a separate TeacherAssignment row.
    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one subject is required",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One row per (teacher, section) — subjects list is merged/updated in place
// rather than allowing duplicate rows for the same pair.
teacherAssignmentSchema.index({ teacherId: 1, sectionId: 1 }, { unique: true });

export default mongoose.models.TeacherAssignment ||
  mongoose.model("TeacherAssignment", teacherAssignmentSchema);
