import z from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  locationName: z.string().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const subscribeLocationSchema = z.object({
  northeastLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),

  northeastLng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),

  southwestLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),

  southwestLng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),

  address: z.string().optional(),
  name: z.string().optional(),
});

export type SubscribeLocationInput = z.infer<typeof subscribeLocationSchema>;

export const updateUserOwnLocationSubscriptionSchema = z.object({
  latitude: z.number().min(-90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180, "Longitude must be between -180 and 180"),
  locationName: z.string().min(1, "Location name is required"),
});

export type UpdateOwnLocationSubscriptionInput = z.infer<
  typeof updateUserOwnLocationSubscriptionSchema
>;

export const updateOwnLocationSubscriptionRadiusSchema = z.object({
  radiusKm: z
    .number()
    .min(1, "Radius must be at least 1 km")
    .max(100, "Radius cannot exceed 100 km"),
});

export type UpdateOwnLocationSubscriptionRadiusInput = z.infer<
  typeof updateOwnLocationSubscriptionRadiusSchema
>;

export const updateNotificationSettingsSchema = z.object({
  awsEmergency: z.boolean(),

  awsWatchAndAct: z.boolean(),

  awsAdvice: z.boolean(),

  officialNonAws: z.boolean(),

  userReported: z.boolean(),

  subscribedCategoryIds: z.array(z.string()),
});

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;
