import z from "zod";

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
