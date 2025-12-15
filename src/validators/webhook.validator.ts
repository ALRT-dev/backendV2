import z from "zod";
import { FireStatus, HazardSeverity, HazardSeverityBand } from "@prisma/client";

export const createHazardWebhookBodySchema = z.object({
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(100, "Title must be at most 100 characters")
    .optional(),

  description: z
    .string()
    .min(1, "Description cannot be empty")
    .max(1000, "Description must be at most 1000 characters"),

  aiSummary: z
    .string()
    .min(1, "Summary cannot be empty")
    .max(1000, "Summary must be at most 1000 characters")
    .optional(),

  severity: z.enum(HazardSeverity).optional(),

  severityBand: z.enum(HazardSeverityBand).optional(),

  callToAction: z
    .string()
    .min(1, "Call to action cannot be empty")
    .max(500, "Call to action must be at most 500 characters")
    .optional(),

  fireStatus: z.enum(FireStatus).optional(),

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

  northeastLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),

  northeastLng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),

  southwestLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),

  southwestLng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),

  categoryId: z
    .string()
    .min(1, "Invalid categoryId provided")
    .max(50, "Invalid categoryId provided")
    .optional(),

  sourceId: z
    .string()
    .min(1, "Invalid sourceId provided")
    .max(50, "Invalid sourceId provided"),

  isAwsCompliant: z.boolean().optional(),

  link: z.url("Invalid URL format").optional(),

  occurredAt: z.iso.datetime().optional(),

  expiresAt: z.iso.datetime().optional(),
});

export type CreateHazardWebhookBody = z.infer<
  typeof createHazardWebhookBodySchema
>;

export const createHazardsWebhookBodySchema = z
  .array(createHazardWebhookBodySchema)
  .min(1, "At least one hazard is required");

export type CreateHazardsWebhookBody = z.infer<
  typeof createHazardsWebhookBodySchema
>;
