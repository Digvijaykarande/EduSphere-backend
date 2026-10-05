import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const upsertSyllabusSchema = z.object({
  sectionId: objectId,
  subject: z.string().min(1),
  progressPercentage: z.number().min(0).max(100),
  currentUnit: z.string().optional().default(""),
  color: z.string().optional().default("#6366f1"),
});
