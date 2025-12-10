import z from "zod";
import { PushNotificationPreference } from "../enums/notification_preference_types.js";

export const setUserLocationSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  locationName: z.string().min(1, "Location name is required"),
});

export type SetUserLocationInput = z.infer<typeof setUserLocationSchema>;

export const setUserRadiusSchema = z.object({
  radiusInKm: z
    .number()
    .min(1, "Radius must be at least 1 km")
    .max(50, "Radius cannot exceed 50 km"),
});

export type SetUserRadiusInput = z.infer<typeof setUserRadiusSchema>;

export const setPushNotificationPreferenceSchema = z.object({
  pushNotificationPreference: z.enum(PushNotificationPreference, {
    message:
      "Invalid notification preference. Must be 'all', 'official', or 'userReported'",
  }),
});

export type SetPushNotificationPreferenceInput = z.infer<
  typeof setPushNotificationPreferenceSchema
>;
