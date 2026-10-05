import { z } from "zod";

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const applyLeaveSchema = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().min(3, "Reason is required"),
  })
  .refine((data) => new Date(data.toDate) >= new Date(data.fromDate), {
    message: "toDate must be on or after fromDate",
    path: ["toDate"],
  });

export const reviewLeaveSchema = z.object({
  reviewerNote: z.string().optional().default(""),
});

export const leaveInboxQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "DENIED"]).optional(),
});
