import { z } from "zod";
import { ATTENDANCE_STATUSES } from "../models/attendance.constants.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const rosterQuerySchema = z.object({
  sectionId: objectId,
  subject: z.string().min(1),
  period: z.string().min(1),
  date: isoDate,
});

export const markAttendanceSchema = z.object({
  sectionId: objectId,
  subject: z.string().min(1),
  period: z.string().min(1),
  date: isoDate,
  marks: z
    .array(
      z.object({
        studentId: objectId,
        status: z.enum(ATTENDANCE_STATUSES),
      })
    )
    .min(1, "At least one mark is required"),
});

export const studentHistoryQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const sectionSummaryQuerySchema = z.object({
  sectionId: objectId,
  date: isoDate,
});

export const schoolTrendQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
