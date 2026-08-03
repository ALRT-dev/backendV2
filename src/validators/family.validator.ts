import z from "zod";

const latitudeSchema = z
  .number()
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90");

const longitudeSchema = z
  .number()
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180");

export const createFamilyCircleSchema = z.object({
  name: z
    .string()
    .min(1, "Circle name is required")
    .max(50, "Circle name must be at most 50 characters"),
});

export type CreateFamilyCircleInput = z.infer<typeof createFamilyCircleSchema>;

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour like #5B5BD6");

export const updateFamilyCircleSchema = z.object({
  name: z
    .string()
    .min(1, "Circle name is required")
    .max(50, "Circle name must be at most 50 characters")
    .optional(),
  themeColor: hexColor.nullable().optional(),
});

export type UpdateFamilyCircleInput = z.infer<typeof updateFamilyCircleSchema>;

export const joinFamilyCircleSchema = z.object({
  code: z
    .string()
    .min(4, "Invite code is required")
    .max(20, "Invalid invite code"),
});

export type JoinFamilyCircleInput = z.infer<typeof joinFamilyCircleSchema>;

export const updateFamilyMemberSchema = z.object({
  nickname: z
    .string()
    .min(1)
    .max(30, "Nickname must be at most 30 characters")
    .optional(),
  sharingLevel: z
    .enum(["precise", "approximate", "alertsOnly", "off"])
    .optional(),
  colorHex: hexColor.nullable().optional(),
});

export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;

export const familyLocationPingSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracy: z.number().min(0).max(100000).optional(),
  speed: z.number().min(0).max(1000).optional(),
  heading: z.number().min(0).max(360).optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  isMoving: z.boolean().optional(),
});

export type FamilyLocationPingInput = z.infer<typeof familyLocationPingSchema>;

export const familyCheckInSchema = z.object({
  status: z.enum(["safe", "needsHelp"]).optional(),
  message: z.string().max(280).optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  requestId: z.string().uuid().optional(),
  hazardId: z.string().max(100).optional(),
});

export type FamilyCheckInInput = z.infer<typeof familyCheckInSchema>;

export const familyCheckInRequestSchema = z.object({
  message: z.string().max(280).optional(),
  hazardId: z.string().max(100).optional(),
});

export type FamilyCheckInRequestInput = z.infer<
  typeof familyCheckInRequestSchema
>;

export const familyScheduledCheckInSchema = z.object({
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timeOfDay must be HH:mm (24h)"),
  mode: z.enum(["automatic", "prompted"]).optional(),
});

export type FamilyScheduledCheckInInput = z.infer<
  typeof familyScheduledCheckInSchema
>;

export const createFamilyPlaceSchema = z.object({
  name: z
    .string()
    .min(1, "Place name is required")
    .max(40, "Place name must be at most 40 characters"),
  icon: z.enum(["home", "work", "school", "heart", "other"]).optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  radiusMeters: z.number().int().min(50).max(5000).optional(),
  address: z.string().max(200).optional(),
});

export type CreateFamilyPlaceInput = z.infer<typeof createFamilyPlaceSchema>;

export const updateFamilyPlaceSchema = createFamilyPlaceSchema.partial();

export type UpdateFamilyPlaceInput = z.infer<typeof updateFamilyPlaceSchema>;

export const updateFamilyPlacePrefSchema = z.object({
  subjectMemberId: z.string().uuid(),
  notifyArrivals: z.boolean(),
  notifyDepartures: z.boolean(),
});

export type UpdateFamilyPlacePrefInput = z.infer<
  typeof updateFamilyPlacePrefSchema
>;

export const respondFamilyLocationRequestSchema = z.object({
  share: z.boolean(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
});

export type RespondFamilyLocationRequestInput = z.infer<
  typeof respondFamilyLocationRequestSchema
>;

export const triggerFamilySosSchema = z.object({
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  sosListId: z.string().uuid().optional(),
});

export type TriggerFamilySosInput = z.infer<typeof triggerFamilySosSchema>;

export const respondFamilySosSchema = z.object({
  type: z.enum(["seen", "onMyWay", "called"]),
});

export type RespondFamilySosInput = z.infer<typeof respondFamilySosSchema>;

export const familySosListSchema = z.object({
  name: z.string().min(1).max(40),
  memberIds: z.array(z.string().uuid()).max(50),
  isDefault: z.boolean().optional(),
});

export type FamilySosListInput = z.infer<typeof familySosListSchema>;

export const familySosListUpdateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  memberIds: z.array(z.string().uuid()).max(50).optional(),
  isDefault: z.boolean().optional(),
});

export type FamilySosListUpdateInput = z.infer<
  typeof familySosListUpdateSchema
>;
