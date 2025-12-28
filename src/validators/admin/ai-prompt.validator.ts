import z from "zod";

// GET /:id - params
export const getAIPromptByIdParamsSchema = z.object({
  id: z.string().min(1, "Prompt ID is required"),
});

export type GetAIPromptByIdParams = z.infer<typeof getAIPromptByIdParamsSchema>;

// POST / - body
export const createAIPromptBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),

  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),

  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content must be at most 50000 characters"),

  variables: z
    .array(z.string())
    .min(0, "Variables must be an array")
    .default([]),

  model: z
    .string()
    .min(1, "Model is required")
    .max(100, "Model must be at most 100 characters"),

  groupId: z.string().max(100, "Group ID must be at most 100 characters"),
});

export type CreateAIPromptBody = z.infer<typeof createAIPromptBodySchema>;

// PUT /:id - params and body
export const updateAIPromptParamsSchema = z.object({
  id: z.string().min(1, "Prompt ID is required"),
});

export type UpdateAIPromptParams = z.infer<typeof updateAIPromptParamsSchema>;

export const updateAIPromptBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),

  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),

  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content must be at most 50000 characters")
    .optional(),

  variables: z
    .array(z.string())
    .min(0, "Variables must be an array")
    .optional(),

  model: z
    .string()
    .min(1, "Model is required")
    .max(100, "Model must be at most 100 characters")
    .optional(),

  groupId: z
    .string()
    .max(100, "Group ID must be at most 100 characters")
    .optional(),
});

export type UpdateAIPromptBody = z.infer<typeof updateAIPromptBodySchema>;

// DELETE /:id - params
export const deleteAIPromptParamsSchema = z.object({
  id: z.string().min(1, "Prompt ID is required"),
});

export type DeleteAIPromptParams = z.infer<typeof deleteAIPromptParamsSchema>;
