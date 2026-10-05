import mongoose from "mongoose";

// A single fee-head line on a student's ledger, tracked with its own
// paid amount so per-head status (e.g. "Tuition: Paid, Transport: Pending")
// is always derivable — not just a single blended total.
const feeLineSchema = new mongoose.Schema(
  {
    particular: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

export const STUDENT_FEE_STATUS = ["Pending", "Partial Paid", "Paid"];

/**
 * StudentFee = the real, per-student ledger for one academic year. Created
 * (snapshotted) from a FeeStructure when a student is assigned fees, so
 * later edits to the class-wide structure don't silently rewrite a
 * student's existing dues. Per-student discounts/exceptions are supported
 * by editing this document's own `breakdown` directly.
 */
const studentFeeSchema = new mongoose.Schema(
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
    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    // Snapshot of the student's class at assignment time — used for
    // class-filtered listing without needing to join Student every time.
    gradeClass: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      default: "",
      trim: true,
    },
    breakdown: {
      type: [feeLineSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Breakdown cannot be empty",
      },
    },
    totalFees: { type: Number, required: true, min: 0, default: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    pendingAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: STUDENT_FEE_STATUS,
      default: "Pending",
    },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// One fee ledger per student per academic year per school.
studentFeeSchema.index(
  { schoolId: 1, studentId: 1, academicYear: 1 },
  { unique: true }
);
studentFeeSchema.index({ schoolId: 1, gradeClass: 1, status: 1 });

// Recompute totals/status from the breakdown lines. Called before every save
// so the ledger can never drift out of sync with its own line items.
studentFeeSchema.methods.recalculate = function recalculate() {
  this.totalFees = this.breakdown.reduce((sum, l) => sum + l.amount, 0);
  this.paidAmount = this.breakdown.reduce((sum, l) => sum + l.paidAmount, 0);
  this.pendingAmount = Math.max(this.totalFees - this.paidAmount, 0);

  if (this.paidAmount <= 0) this.status = "Pending";
  else if (this.pendingAmount <= 0) this.status = "Paid";
  else this.status = "Partial Paid";
};

studentFeeSchema.pre("save", function preSave(next) {
  this.recalculate();
  next();
});

export default mongoose.models.StudentFee ||
  mongoose.model("StudentFee", studentFeeSchema);
