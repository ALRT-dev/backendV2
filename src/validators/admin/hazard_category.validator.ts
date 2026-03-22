import z from "zod";
import { CategoryImageType } from "@prisma/client";

const categoryImageTypeEnum = z.enum([
  CategoryImageType.info,
  CategoryImageType.monitor,
  CategoryImageType.action,
  CategoryImageType.critical,
  CategoryImageType.advice,
  CategoryImageType.watchAndAct,
  CategoryImageType.emergency,
]);

const imageDimensionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const imageDimensionsSchema = z
  .record(categoryImageTypeEnum, imageDimensionSchema)
  .optional();

export type ImageDimensions = z.infer<typeof imageDimensionsSchema>;

export const getCategoriesForAdminQuerySchema = z.object({});

export type GetCategoriesForAdminQuery = z.infer<
  typeof getCategoriesForAdminQuerySchema
>;

export const createHazardCategoryForAdminBodySchema = z.object({
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
    .max(100, "Name must be at most 100 characters"),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),

  color: z
    .string()
    .regex(
      /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      "Color must be a valid hex color code",
    )
    .optional(),

  keywords: z.array(z.string().min(1).max(100)).optional(),

  isFireRelated: z.boolean().optional(),

  parentId: z.string().optional(),

  imageDimensions: imageDimensionsSchema,
});

export type CreateHazardCategoryForAdminBody = z.infer<
  typeof createHazardCategoryForAdminBodySchema
>;

export const updateHazardCategoryForAdminBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .nullable()
    .optional(),

  color: z
    .string()
    .regex(
      /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      "Color must be a valid hex color code",
    )
    .nullable()
    .optional(),

  keywords: z.array(z.string().min(1).max(100)).optional(),

  isFireRelated: z.boolean().optional(),

  parentId: z.string().nullable().optional(),

  imageDimensions: imageDimensionsSchema,
});

export type UpdateHazardCategoryForAdminBody = z.infer<
  typeof updateHazardCategoryForAdminBodySchema
>;
