import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

// --- Section ---

export const createSectionSchema = z.object({
  gradeClass: z.string().min(1, "Grade / Class is required"),
  section: z.string().min(1, "Section is required"),
  classTeacherId: objectId,
  room: z.string().optional().default(""),
  seatCapacity: z.number().int().positive().optional().default(40),
  subjects: z.array(z.string()).optional().default([]),
});

export const updateSectionSchema = createSectionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// --- TeacherAssignment ---

export const createAssignmentSchema = z.object({
  teacherId: objectId,
  sectionId: objectId,
  subjects: z.array(z.string().min(1)).min(1, "At least one subject is required"),
});

export const updateAssignmentSchema = z.object({
  subjects: z.array(z.string().min(1)).min(1, "At least one subject is required").optional(),
  isActive: z.boolean().optional(),
});
