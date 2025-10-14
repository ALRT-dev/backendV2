import z from "zod";

export const createHazardSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),

  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters"),

  categoryId: z.string().uuid("Category ID must be a valid UUID"),

  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),

  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),

  severity: z
    .enum(["info", "advice", "watchAndAct", "emergency"])
    .optional()
    .default("info"),

  occurredAt: z.string().datetime().optional(),
});

export type CreateHazardInput = z.infer<typeof createHazardSchema>;

export const voteHazardSchema = z.object({
  voteType: z.enum(["upvote", "downvote"], {
    message: "Vote must be either 'upvote' or 'downvote'",
  }),
});

export type VoteHazardInput = z.infer<typeof voteHazardSchema>;

export const getHazardsQuerySchema = z.object({
  searchString: z.string().optional(),

  categoryIds: z.string().optional(), // Comma-separated list of UUIDs

  reportedById: z.string().uuid().optional(),

  reviewStatus: z.enum(["accepted", "rejected"]).optional(),

  page: z.string().regex(/^\d+$/, "Page must be a number").optional(),

  pageSize: z.string().regex(/^\d+$/, "Page size must be a number").optional(),

  northeastLat: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Latitude must be a number")
    .optional(),

  northeastLng: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Longitude must be a number")
    .optional(),

  southwestLat: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Latitude must be a number")
    .optional(),

  southwestLng: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Longitude must be a number")
    .optional(),
});

export type GetHazardsQuery = z.infer<typeof getHazardsQuerySchema>;
