import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const createTimetableSlotSchema = z.object({
  sectionId: objectId,
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
  period: z.string().min(1),
  startMinutes: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().positive().optional().default(45),
  subject: z.string().min(1),
  room: z.string().optional().default(""),
  type: z.enum(["class", "lab", "planning"]).optional().default("class"),
  topic: z.string().optional().default(""),
});

export const updateTimetableSlotSchema = createTimetableSlotSchema.partial().omit({
  sectionId: true,
  day: true,
  period: true,
});

// Principal/school variant — teacher is chosen explicitly since the caller
// isn't the teacher themselves.
export const principalCreateTimetableSlotSchema = createTimetableSlotSchema.extend({
  teacherId: objectId,
});
