import z from "zod";

export const getCategoriesForAdminQuerySchema = z.object({});

export type GetCategoriesForAdminQuery = z.infer<
  typeof getCategoriesForAdminQuerySchema
>;
