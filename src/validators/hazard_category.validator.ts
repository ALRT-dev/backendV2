import z from "zod";

export const createHazardCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name must be less than 50 characters"),

  description: z.string().optional(),

  parentId: z.string().optional(),
});

export type CreateHazardCategoryInput = z.infer<
  typeof createHazardCategorySchema
>;

export const updateHazardCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name must be less than 50 characters")
    .optional(),

  description: z.string().optional(),

  parentId: z.string().optional(),
});

export type UpdateHazardCategoryInput = z.infer<
  typeof updateHazardCategorySchema
>;
