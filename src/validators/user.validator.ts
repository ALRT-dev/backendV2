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
  subscriptionRadiusKm: z
    .number()
    .min(1, "Radius must be at least 1 km")
    .max(50, "Radius cannot exceed 50 km")
    .optional()
    .default(10),
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

const notificationSettingUpdateSchema = z.object({
  settingType: z.string().min(1, "Setting type is required"),
  settingKey: z.string().min(1, "Setting key is required"),
  isEnabled: z.boolean(),
});
export type NotificationSettingUpdate = z.infer<
  typeof notificationSettingUpdateSchema
>;

export const updateNotificationSettingsSchema = z.object({
  updates: z
    .array(notificationSettingUpdateSchema)
    .min(1, "At least one update is required"),
});

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;
