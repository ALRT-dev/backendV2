import z from "zod";

export const createWebhookApiKeyBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),

  maxRequestsPerMinute: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(60, "Must be at most 60")
    .default(10),

  maxRequestsPerHour: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(1000, "Must be at most 1000")
    .default(100),

  maxRequestsPerDay: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(10000, "Must be at most 10000")
    .default(1000),

  expiresAt: z.string().datetime().optional(),
});

export type CreateWebhookApiKeyBody = z.infer<
  typeof createWebhookApiKeyBodySchema
>;

export const updateWebhookApiKeyBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),

  isActive: z.boolean().optional(),

  maxRequestsPerMinute: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(60, "Must be at most 60")
    .optional(),

  maxRequestsPerHour: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(1000, "Must be at most 1000")
    .optional(),

  maxRequestsPerDay: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(10000, "Must be at most 10000")
    .optional(),

  expiresAt: z.string().datetime().optional().nullable(),
});

export type UpdateWebhookApiKeyBody = z.infer<
  typeof updateWebhookApiKeyBodySchema
>;
