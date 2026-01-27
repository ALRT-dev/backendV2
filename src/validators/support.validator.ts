import z from "zod";
import { SupportRequestType } from "../enums/support_request_types.js";

export const submitSupportRequestSchema = z.object({
  requestType: z
    .enum(SupportRequestType)
    .refine((val) => Object.values(SupportRequestType).includes(val), {
      message:
        "Request type must be one of: support, feedback, question, other.",
    }),
  details: z
    .string()
    .min(1, "Details cannot be empty.")
    .max(2000, "Details must not exceed 2000 characters."),
  userName: z.string().max(100).optional(),
  userEmail: z.email("Invalid email format.").optional(),
});

export type SubmitSupportRequestInput = z.infer<
  typeof submitSupportRequestSchema
>;
