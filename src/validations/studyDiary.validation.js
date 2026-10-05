import { z } from "zod";

export const createDiaryEntrySchema = z.object({
  content: z.string().min(1, "Entry content is required"),
  duration: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
});
