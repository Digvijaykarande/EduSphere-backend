import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const allocationSchema = new mongoose.Schema(
  {
    particular: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

export const PAYMENT_METHODS = [
  "Cash",
  "Cheque",
  "UPI",
  "Card",
  "Bank Transfer",
  "Online",
];
export const PAYMENT_STATUS = ["SUCCESS", "PENDING", "FAILED"];

/**
 * Payment = an immutable record of money received against a student's fee
 * ledger. Currently written by the principal/school side ("record a payment
 * collected at the office"). Online self-checkout (status starting PENDING,
 * settled by a gateway webhook) can plug into the same model later.
 */
const paymentSchema = new mongoose.Schema(
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    studentFeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentFee",
      required: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
    },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUS, default: "SUCCESS" },
    // How this payment was split across fee heads — always populated
    // (auto-allocated oldest-unpaid-head-first if the caller doesn't specify).
    allocations: { type: [allocationSchema], default: [] },
    referenceNo: { type: String, default: "", trim: true }, // cheque no / UPI txn id / gateway id
    note: { type: String, default: "", trim: true },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentSchema.statics.generateUniquePaymentSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug("pay");
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug });
    if (!exists) return slug;
  }
  return generateSlug("pay") + generateSlug("pay").slice(4);
};

export default mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
