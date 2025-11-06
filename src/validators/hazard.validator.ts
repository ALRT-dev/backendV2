import z from "zod";

export const createHazardDataSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),

  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters"),

  categoryId: z.string(),

  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),

  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),

  locationName: z
    .string()
    .min(1, "Location name is required")
    .max(200, "Location name must be less than 200 characters")
    .optional(),

  occurredAt: z.string().datetime().optional(),
});

export const createHazardSchema = z.object({
  hazard: z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      return createHazardDataSchema.parse(parsed);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid JSON format for hazard data",
      });
      return z.NEVER;
    }
  }),
  // mediaFiles field are handled by multer middleware and will be available in req.files so no need to validate here
});

export type CreateHazardInput = z.infer<typeof createHazardSchema>;

export const updateHazardDataSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters")
    .optional(),

  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters")
    .optional(),

  categoryId: z.string().optional(),

  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),

  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),

  locationName: z
    .string()
    .min(1, "Location name is required")
    .max(200, "Location name must be less than 200 characters")
    .optional(),

  occurredAt: z.iso.datetime().optional(),
});

export const updateHazardSchema = z.object({
  hazard: z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      return updateHazardDataSchema.parse(parsed);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid JSON format for hazard data",
      });
      return z.NEVER;
    }
  }),

  removedMediaIds: z
    .union([
      z.array(z.string().uuid()),
      z.string().transform((str) => {
        return str.split(",").map((id) => id.trim());
      }),
    ])
    .pipe(z.array(z.string().uuid()))
    .optional(),

  // mediaFiles field are handled by multer middleware and will be available in req.files so no need to validate here
});

export type UpdateHazardInput = z.infer<typeof updateHazardSchema>;

export const voteHazardSchema = z.object({
  voteType: z.enum(["upvote", "downvote"], {
    message: "Vote must be either 'upvote' or 'downvote'",
  }),
});

export type VoteHazardInput = z.infer<typeof voteHazardSchema>;

export const getHazardsQuerySchema = z.object({
  searchString: z.string().optional(),

  categoryIds: z.string().optional(),

  severityFilter: z
    .object({
      aws: z
        .array(
          z.enum(["unknown", "info", "advice", "watchAndAct", "emergency"])
        )
        .optional(),
      nonAws: z
        .array(
          z.enum(["unknown", "info", "advice", "watchAndAct", "emergency"])
        )
        .optional(),
    })
    .optional(),

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

  showExpired: z
    .string()
    .regex(/^(true|false)$/, "showExpired must be 'true' or 'false'")
    .optional(),

  sortSettings: z
    .array(
      z.object({
        severity: z.enum(["asc", "desc"]).optional(),
        distance: z.enum(["asc", "desc"]).optional(),
        createdAt: z.enum(["asc", "desc"]).optional(),
        confidenceScore: z.enum(["asc", "desc"]).optional(),
      })
    )
    .optional(),
});

export type GetHazardsQuery = z.infer<typeof getHazardsQuerySchema>;

export const getHazardFiltersQuerySchema = z.object({
  searchString: z.string().optional(),

  reportedById: z.string().uuid().optional(),

  reviewStatus: z.enum(["accepted", "rejected"]).optional(),

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

  showExpired: z
    .string()
    .regex(/^(true|false)$/, "showExpired must be 'true' or 'false'")
    .optional(),

  includeSubscribed: z
    .string()
    .regex(/^(true|false)$/, "includeSubscribed must be 'true' or 'false'")
    .optional(),
});

export type GetHazardFiltersQuery = z.infer<typeof getHazardFiltersQuerySchema>;
