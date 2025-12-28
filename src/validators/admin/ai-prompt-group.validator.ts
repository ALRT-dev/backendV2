import z from "zod";

export const createAIPromptGroupForAdminBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

export type CreateAIPromptGroupForAdminBody = z.infer<
  typeof createAIPromptGroupForAdminBodySchema
>;

export const updateAIPromptGroupForAdminBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

export type UpdateAIPromptGroupForAdminBody = z.infer<
  typeof updateAIPromptGroupForAdminBodySchema
>;

export const deleteAIPromptGroupForAdminParamsSchema = z.object({
  id: z.string().min(1, "Group ID is required"),
});

export type DeleteAIPromptGroupForAdminParams = z.infer<
  typeof deleteAIPromptGroupForAdminParamsSchema
>;
