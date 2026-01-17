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
      "Color must be a valid hex color code",
    )
    .optional(),

  keywords: z.array(z.string().min(1).max(100)).optional(),

  isFireRelated: z.boolean().optional(),

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
      "Color must be a valid hex color code",
    )
    .optional(),

  keywords: z.array(z.string().min(1).max(100)).optional(),

  isFireRelated: z.boolean().optional(),

  parentId: z.string().optional(),
});

export type UpdateHazardCategoryForAdminBody = z.infer<
  typeof updateHazardCategoryForAdminBodySchema
>;
