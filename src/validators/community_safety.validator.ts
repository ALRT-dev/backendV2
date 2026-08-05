import z from "zod";

/**
 * A fixed reason list, deliberately with no free-text field: it keeps flags
 * useful for triage and stops the flag itself becoming a channel for abuse.
 */
export const flagHazardSchema = z.object({
  reason: z.enum([
    "inappropriate",
    "misleading",
    "spam",
    "harassment",
    "other",
  ]),
});

export type FlagHazardInput = z.infer<typeof flagHazardSchema>;

export const blockUserSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export type BlockUserInput = z.infer<typeof blockUserSchema>;
