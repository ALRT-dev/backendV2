import z from "zod";
import {
  HazardSourceShape,
  HazardSeveritySystem,
  SeverityLevelHandling,
  HazardSeverityBand,
  SourcePushPolicy,
} from "@prisma/client";

export const getHazardSourcesForAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  searchString: z.string().max(200).optional(),
});

export type GetHazardSourcesForAdminQuery = z.infer<
  typeof getHazardSourcesForAdminQuerySchema
>;

export const createHazardSourceForAdminBodySchema = z.object({
  id: z
    .string()
    .min(1, "ID is required")
    .max(50, "ID must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "ID must contain only alphanumeric characters, underscores, and hyphens",
    )
    .optional(),

  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),

  url: z
    .url("URL must be a valid URL")
    .max(500, "URL must be at most 500 characters"),

  imageUrl: z
    .url("Image URL must be a valid URL")
    .max(500, "Image URL must be at most 500 characters")
    .optional(),

  licenseId: z.uuid("License ID must be a valid UUID").optional(),

  advisoryText: z
    .string()
    .max(1000, "Advisory text must be at most 1000 characters")
    .optional(),

  copyrightText: z
    .string()
    .max(1000, "Copyright text must be at most 1000 characters")
    .optional(),

  copyrightLink: z
    .url("Copyright link must be a valid URL")
    .max(500, "Copyright link must be at most 500 characters")
    .optional(),

  // V3 "One Glance" source registry (see V3 verification checklist §1).
  shape: z.enum(HazardSourceShape).optional(),
  severitySystem: z.enum(HazardSeveritySystem).optional(),
  levelHandling: z.enum(SeverityLevelHandling).optional(),
  stickiness: z
    .number()
    .int()
    .min(0, "Stickiness must be a non-negative number of minutes")
    .max(20160, "Stickiness must be at most 14 days (20160 minutes)")
    .optional(),
  maxInternalBand: z.enum(HazardSeverityBand).optional(),
  pushPolicy: z.enum(SourcePushPolicy).optional(),
});

export type CreateHazardSourceForAdminBody = z.infer<
  typeof createHazardSourceForAdminBodySchema
>;

export const updateHazardSourceForAdminBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters")
    .optional(),

  url: z
    .url("URL must be a valid URL")
    .max(500, "URL must be at most 500 characters")
    .optional(),

  imageUrl: z
    .url("Image URL must be a valid URL")
    .max(500, "Image URL must be at most 500 characters")
    .nullable()
    .optional(),

  licenseId: z.uuid("License ID must be a valid UUID").nullable().optional(),

  advisoryText: z
    .string()
    .max(1000, "Advisory text must be at most 1000 characters")
    .nullable()
    .optional(),

  copyrightText: z
    .string()
    .max(1000, "Copyright text must be at most 1000 characters")
    .nullable()
    .optional(),

  copyrightLink: z
    .url("Copyright link must be a valid URL")
    .max(500, "Copyright link must be at most 500 characters")
    .nullable()
    .optional(),

  // V3 "One Glance" source registry (see V3 verification checklist §1).
  // `null` clears the field back to the documented render default.
  shape: z.enum(HazardSourceShape).nullable().optional(),
  severitySystem: z.enum(HazardSeveritySystem).nullable().optional(),
  levelHandling: z.enum(SeverityLevelHandling).nullable().optional(),
  stickiness: z
    .number()
    .int()
    .min(0, "Stickiness must be a non-negative number of minutes")
    .max(20160, "Stickiness must be at most 14 days (20160 minutes)")
    .nullable()
    .optional(),
  maxInternalBand: z.enum(HazardSeverityBand).nullable().optional(),
  pushPolicy: z.enum(SourcePushPolicy).nullable().optional(),
});

export type UpdateHazardSourceForAdminBody = z.infer<
  typeof updateHazardSourceForAdminBodySchema
>;

// License validators
export const createHazardSourceLicenseForAdminBodySchema = z.object({
  badgeText: z
    .string()
    .min(1, "Badge text is required")
    .max(50, "Badge text must be at most 50 characters"),

  licenseText: z
    .string()
    .min(1, "License text is required")
    .max(200, "License text must be at most 200 characters"),

  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),

  link: z
    .url("Link must be a valid URL")
    .max(500, "Link must be at most 500 characters")
    .optional(),

  foregroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Foreground color must be a valid hex color")
    .optional(),

  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Background color must be a valid hex color")
    .optional(),
});

export type CreateHazardSourceLicenseForAdminBody = z.infer<
  typeof createHazardSourceLicenseForAdminBodySchema
>;

export const updateHazardSourceLicenseForAdminBodySchema = z.object({
  badgeText: z
    .string()
    .min(1, "Badge text is required")
    .max(50, "Badge text must be at most 50 characters")
    .optional(),

  licenseText: z
    .string()
    .min(1, "License text is required")
    .max(200, "License text must be at most 200 characters")
    .optional(),

  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .nullable()
    .optional(),

  link: z
    .url("Link must be a valid URL")
    .max(500, "Link must be at most 500 characters")
    .nullable()
    .optional(),

  foregroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Foreground color must be a valid hex color")
    .nullable()
    .optional(),

  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Background color must be a valid hex color")
    .nullable()
    .optional(),
});

export type UpdateHazardSourceLicenseForAdminBody = z.infer<
  typeof updateHazardSourceLicenseForAdminBodySchema
>;
