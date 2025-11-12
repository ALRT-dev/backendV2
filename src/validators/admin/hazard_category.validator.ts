import z from "zod";

export const getCategoriesForAdminQuerySchema = z.object({});

export type GetCategoriesForAdminQuery = z.infer<
  typeof getCategoriesForAdminQuerySchema
>;

export const createHazardCategoryForAdminBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),

  color: z
    .string()
    .regex(
      /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      "Color must be a valid hex color code"
    )
    .optional(),

  severityKeywords: z.record(z.string(), z.array(z.string())).optional(),

  callToActions: z.record(z.string(), z.string()).optional(),

  aiInstructions: z
    .string()
    .max(1000, "AI instructions must be at most 1000 characters")
    .optional(),

  parentId: z.string().optional(),
});

export type CreateHazardCategoryForAdminBody = z.infer<
  typeof createHazardCategoryForAdminBodySchema
>;

export const updateHazardCategoryForAdminBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),

  color: z
    .string()
    .regex(
      /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      "Color must be a valid hex color code"
    )
    .optional(),

  severityKeywords: z.record(z.string(), z.array(z.string())).optional(),

  callToActions: z.record(z.string(), z.string()).optional(),

  aiInstructions: z
    .string()
    .max(1000, "AI instructions must be at most 1000 characters")
    .optional(),

  parentId: z.string().optional(),
});

export type UpdateHazardCategoryForAdminBody = z.infer<
  typeof updateHazardCategoryForAdminBodySchema
>;
