import z from "zod";
import { SyncHazardsFromExternalSourceOption } from "../../enums/sync_hazards_from_external_source_option_types.js";

export const getHazardsForAdminQuerySchema = z.object({
  searchString: z.string().optional(),

  categoryIds: z.string().optional(),

  awsEmergency: z
    .string()
    .regex(/^(true|false)$/, "awsEmergency must be 'true' or 'false'")
    .optional(),

  awsWatchAndAct: z
    .string()
    .regex(/^(true|false)$/, "awsWatchAndAct must be 'true' or 'false'")
    .optional(),

  awsAdvice: z
    .string()
    .regex(/^(true|false)$/, "awsAdvice must be 'true' or 'false'")
    .optional(),

  officialNonAws: z
    .string()
    .regex(/^(true|false)$/, "officialNonAws must be 'true' or 'false'")
    .optional(),

  userReported: z
    .string()
    .regex(/^(true|false)$/, "userReported must be 'true' or 'false'")
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
        severityBand: z.enum(["asc", "desc"]).optional(),
        distance: z.enum(["asc", "desc"]).optional(),
        createdAt: z.enum(["asc", "desc"]).optional(),
        confidenceScore: z.enum(["asc", "desc"]).optional(),
      })
    )
    .optional(),
});

export type GetHazardsForAdminQuery = z.infer<
  typeof getHazardsForAdminQuerySchema
>;

export const createHazardForAdminBodySchema = z.object({
  title: z.string().max(100, "Title must be at most 100 characters").optional(),

  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be at most 5000 characters"),

  aiSummary: z.string().min(1, "Summary is required").optional(),

  callToAction: z
    .string()
    .max(500, "Call to action must be at most 500 characters")
    .optional(),

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
    .max(200, "Location name must be at most 200 characters")
    .optional(),

  categoryId: z.string(),

  fireStatus: z
    .enum(["active", "beingControlled", "underControl", "closed"])
    .optional(),

  isAwsCompliant: z.boolean().optional(),

  severity: z
    .enum(["unknown", "info", "advice", "watchAndAct", "emergency"])
    .optional(),

  sourceId: z.string().uuid().optional(),

  occurredAt: z.iso.datetime().optional(),
});

export type CreateHazardForAdminBody = z.infer<
  typeof createHazardForAdminBodySchema
>;

export const updateHazardForAdminBodySchema = z.object({
  title: z.string().max(100, "Title must be at most 100 characters").optional(),

  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be at most 5000 characters")
    .optional(),

  aiSummary: z.string().min(1, "Summary is required").optional(),

  callToAction: z
    .string()
    .max(500, "Call to action must be at most 500 characters")
    .optional(),

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
    .max(200, "Location name must be at most 200 characters")
    .optional(),

  categoryId: z.string().optional(),

  fireStatus: z
    .enum(["active", "beingControlled", "underControl", "closed"])
    .optional(),

  isAwsCompliant: z.boolean().optional(),

  severity: z
    .enum(["unknown", "info", "advice", "watchAndAct", "emergency"])
    .optional(),

  sourceId: z.string().uuid().optional(),

  occurredAt: z.iso.datetime().optional(),
});

export type UpdateHazardForAdminBody = z.infer<
  typeof updateHazardForAdminBodySchema
>;

export const syncHazardsFromExternalSourceForAdminBodySchema = z.object({
  sourceIds: z.array(z.string()).optional(),

  syncOption: z
    .nativeEnum(SyncHazardsFromExternalSourceOption)
    .default(SyncHazardsFromExternalSourceOption.replaceExisting),
});

export type SyncHazardsFromExternalSourceForAdminBody = z.infer<
  typeof syncHazardsFromExternalSourceForAdminBodySchema
>;
