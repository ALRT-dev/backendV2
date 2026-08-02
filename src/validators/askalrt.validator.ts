import z from "zod";

export const askAlrtBodySchema = z.object({
  question: z
    .string()
    .min(2, "question must be at least 2 characters")
    .max(500, "question must be at most 500 characters"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type AskAlrtBody = z.infer<typeof askAlrtBodySchema>;
