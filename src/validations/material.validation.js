import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const createMaterialSchema = z.object({
  sectionId: objectId,
  subject: z.string().optional().default(""),
  title: z.string().min(1),
  type: z.enum(["pdf", "video", "folder", "link"]),
  url: z.string().min(1, "A file upload or link URL is required"),
  fileSize: z.number().optional().default(0),
  duration: z.string().optional().default(""),
});
