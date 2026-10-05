import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createExamSchema = z
  .object({
    title: z.string().trim().min(1, "Exam title is required"),
    subject: z.string().trim().min(1, "Subject is required"),
    type: z.enum(["Theory", "Practical", "Oral", "Project"]).default("Theory"),
    sectionIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one class or section"),
    date: z.coerce.date(),
    startTime: z.string().regex(timeRegex, "Invalid start time"),
    endTime: z.string().regex(timeRegex, "Invalid end time"),
    room: z.string().trim().optional().default(""),
    maxMarks: z.coerce.number().positive("Enter total marks"),
    passingMarks: z.coerce.number().min(0),
    weightage: z.coerce.number().min(0).max(100).default(0),
    instructions: z.string().trim().optional().default(""),
  })
  .refine((data) => data.passingMarks <= data.maxMarks, {
    message: "Passing marks can't exceed total marks",
    path: ["passingMarks"],
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateExamSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    subject: z.string().trim().min(1).optional(),
    type: z.enum(["Theory", "Practical", "Oral", "Project"]).optional(),
    sectionIds: z.array(z.string().min(1)).min(1).optional(),
    date: z.coerce.date().optional(),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
    room: z.string().trim().optional(),
    maxMarks: z.coerce.number().positive().optional(),
    passingMarks: z.coerce.number().min(0).optional(),
    weightage: z.coerce.number().min(0).max(100).optional(),
    instructions: z.string().trim().optional(),
    status: z.enum(["Upcoming", "Completed", "Cancelled"]).optional(),
    syllabusCoverage: z.coerce.number().min(0).max(100).optional(),
    questionPaperStatus: z.enum(["Pending", "Draft", "Uploaded"]).optional(),
  })
  .refine(
    (data) =>
      data.passingMarks === undefined ||
      data.maxMarks === undefined ||
      data.passingMarks <= data.maxMarks,
    { message: "Passing marks can't exceed total marks", path: ["passingMarks"] }
  );

export const examQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["All", "Upcoming", "Completed", "Cancelled"]).optional(),
  subject: z.string().trim().optional(),
  sectionId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const bulkMarksEntrySchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        marksObtained: z.coerce.number().min(0).nullable(),
      })
    )
    .min(1, "At least one entry is required"),
});

export const gradebookQuerySchema = z.object({
  sectionId: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
