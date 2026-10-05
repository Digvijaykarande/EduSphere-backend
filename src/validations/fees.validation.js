import { z } from "zod";
import { PAYMENT_METHODS } from "../models/Payment.js";

const feeHeadSchema = z.object({
  particular: z.string().trim().min(1, "Particular is required").max(100),
  amount: z.number().positive("Amount must be greater than 0"),
});

// Principal: create/update the fee structure (template) for a class.
export const upsertFeeStructureSchema = z.object({
  academicYear: z.string().trim().min(4).max(20),
  gradeClass: z.string().trim().min(1).max(20),
  heads: z.array(feeHeadSchema).min(1, "At least one fee head is required"),
  dueDate: z.coerce.date().optional().nullable(),
});

// Principal: assign/re-sync a structure to every student currently in a class.
export const bulkAssignFeeSchema = z.object({
  academicYear: z.string().trim().min(4).max(20),
  gradeClass: z.string().trim().min(1).max(20),
  // If true, students who already have a ledger for this year keep their
  // existing breakdown (e.g. after a manual discount) untouched.
  skipExisting: z.boolean().optional().default(true),
});

// Principal: assign/override fees for a single student directly.
export const assignStudentFeeSchema = z.object({
  academicYear: z.string().trim().min(4).max(20),
  heads: z.array(feeHeadSchema).min(1, "At least one fee head is required"),
  dueDate: z.coerce.date().optional().nullable(),
});

// Principal: record a payment received against a student's ledger.
export const recordPaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  method: z.enum(PAYMENT_METHODS),
  referenceNo: z.string().trim().max(100).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
  allocations: z
    .array(
      z.object({
        particular: z.string().trim().min(1),
        amount: z.number().positive(),
      })
    )
    .optional(),
  paidAt: z.coerce.date().optional(),
});

export const listSchoolFeesQuerySchema = z.object({
  academicYear: z.string().trim().optional(),
  gradeClass: z.string().trim().optional(),
  status: z.enum(["ALL", "Pending", "Partial Paid", "Paid"]).optional(),
  feeCategory: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const yearQuerySchema = z.object({
  academicYear: z.string().trim().optional(),
});
