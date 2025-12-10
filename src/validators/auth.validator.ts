import z from "zod";

export const registerSchema = z.object({
  email: z.email("Invalid email format").min(1, "Email is required"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be less than 128 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Invalid email format").min(1, "Email is required"),

  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const googleOAuthSchema = z.object({
  idToken: z.string().min(1, "ID Token is required"),
});

export type GoogleOAuthInput = z.infer<typeof googleOAuthSchema>;

export const appleOAuthSchema = z.object({
  identityToken: z.string().min(1, "Identity Token is required"),
  firstName: z
    .string()
    .max(100, "First name must be less than 100 characters")
    .optional(),
  lastName: z
    .string()
    .max(100, "Last name must be less than 100 characters")
    .optional(),
});

export type AppleOAuthInput = z.infer<typeof appleOAuthSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
