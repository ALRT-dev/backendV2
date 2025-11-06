import z from "zod";

export const getNotificationsFeedSchema = z.object({
  searchString: z.string().optional(),

  categoryIds: z.string().optional(), // Comma-separated list of UUIDs

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

  reviewStatus: z.enum(["accepted", "rejected"]).optional(),

  page: z.string().regex(/^\d+$/, "Page must be a number").optional(),

  pageSize: z.string().regex(/^\d+$/, "Page size must be a number").optional(),

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
