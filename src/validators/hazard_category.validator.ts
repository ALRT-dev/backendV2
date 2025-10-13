import z from "zod";

export const createHazardCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name must be less than 50 characters"),

  emoji: z.string().optional(),
});

export type CreateHazardCategoryInput = z.infer<
  typeof createHazardCategorySchema
>;
