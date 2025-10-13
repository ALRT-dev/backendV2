import z from "zod";

export const getNotificationsFeedSchema = z.object({
  searchString: z.string().optional(),

  categoryIds: z.string().optional(), // Comma-separated list of UUIDs

  page: z.string().regex(/^\d+$/, "Page must be a number").optional(),

  pageSize: z.string().regex(/^\d+$/, "Page size must be a number").optional(),
});

export type GetNotificationsFeedQuery = z.infer<
  typeof getNotificationsFeedSchema
>;

export const pushNotificationTokenSchema = z.object({
  token: z.string().min(1, "Device token is required"),

  platform: z.string().optional(),
});

export type PushNotificationTokenInput = z.infer<
  typeof pushNotificationTokenSchema
>;
