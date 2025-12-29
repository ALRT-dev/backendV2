import z from "zod";

export const loginAsAdminBodySchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .min(1, "Email is required")
    .max(255, "Email too long"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character"
    ),
});

export type AdminLoginBody = z.infer<typeof loginAsAdminBodySchema>;

export const adminRefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type AdminRefreshTokenInput = z.infer<typeof adminRefreshTokenSchema>;

export const changeAdminPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password must be less than 128 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangeAdminPasswordInput = z.infer<
  typeof changeAdminPasswordSchema
>;
