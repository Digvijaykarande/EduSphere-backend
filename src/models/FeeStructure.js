import mongoose from "mongoose";

// One line item within a fee structure (e.g. "Tuition Fees" -> 12000).
const feeHeadSchema = new mongoose.Schema(
  {
    particular: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/**
 * FeeStructure = the template a principal defines for a class in a given
 * academic year (e.g. "Class 10, 2025-26 -> Tuition 12000, Transport 4000...").
 * It applies to every section of that grade (10-A, 10-B, ...) unless a
 * student has a per-student override on their StudentFee record.
 */
const feeStructureSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicYear: {
      type: String, // e.g. "2025-26"
      required: true,
      trim: true,
    },
    gradeClass: {
      type: String, // e.g. "10" — matches Student.gradeClass
      required: true,
      trim: true,
    },
    heads: {
      type: [feeHeadSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one fee head is required",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One active structure per class per academic year per school.
feeStructureSchema.index(
  { schoolId: 1, academicYear: 1, gradeClass: 1 },
  { unique: true }
);

feeStructureSchema.pre("validate", function computeTotal(next) {
  if (this.heads?.length) {
    this.totalAmount = this.heads.reduce((sum, h) => sum + h.amount, 0);
  }
  next();
});

export default mongoose.models.FeeStructure ||
  mongoose.model("FeeStructure", feeStructureSchema);
