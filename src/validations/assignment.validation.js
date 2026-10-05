import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  size: z.number().optional().default(0),
  originalSize: z.number().optional().default(0),
  type: z.string().optional().default(""),
});

export const createAssignmentSchema = z.object({
  sectionId: objectId,
  subject: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  dueDate: isoDate,
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: isoDate.optional(),
  attachments: z.array(attachmentSchema).optional(),
  isActive: z.boolean().optional(),
});

export const submitAssignmentSchema = z.object({
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const gradeSubmissionSchema = z.object({
  marks: z.string().min(1, "Marks/grade is required"),
  feedback: z.string().optional().default(""),
});
