import { z } from "zod";

export const createWingSchema = z.object({
  name: z.string().min(1, "Wing name is required"),
  classesLabel: z.string().optional().default(""),
  gradeClasses: z.array(z.string()).optional().default([]),
  iconName: z.enum(["building", "landmark", "shapes"]).optional().default("shapes"),
});

export const updateWingSchema = z.object({
  name: z.string().min(1).optional(),
  classesLabel: z.string().optional(),
  gradeClasses: z.array(z.string()).optional(),
  iconName: z.enum(["building", "landmark", "shapes"]).optional(),
  isActive: z.boolean().optional(),
});

export const reorderWingsSchema = z.object({
  // Ordered list of Wing _ids, front-to-back — the new display order.
  orderedIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1),
});
