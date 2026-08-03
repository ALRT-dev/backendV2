import z from "zod";

export const getAlertsGeoQuerySchema = z.object({
  status: z.enum(["active", "historical"]).default("active").optional(),

  dateFrom: z.string().datetime({ message: "dateFrom must be a valid ISO 8601 datetime" }).optional(),

  dateTo: z.string().datetime({ message: "dateTo must be a valid ISO 8601 datetime" }).optional(),

  source: z.string().optional(),

  severity: z
    .union([
      z.array(z.enum(["unknown", "info", "advice", "watchAndAct", "emergency"])),
      z.enum(["unknown", "info", "advice", "watchAndAct", "emergency"]).transform((v) => [v]),
    ])
    .optional(),

  severityBands: z
    .union([
      z.array(z.enum(["info", "monitor", "action", "critical"])),
      z.enum(["info", "monitor", "action", "critical"]).transform((v) => [v]),
    ])
    .optional(),

  categoryIds: z.string().optional(),

  northeastLat: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Latitude must be a number")
    .optional(),

  northeastLng: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Longitude must be a number")
    .optional(),

  southwestLat: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Latitude must be a number")
    .optional(),

  southwestLng: z
    .string()
    .regex(/^-?\d+\.?\d*$/, "Longitude must be a number")
    .optional(),

  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .optional(),

  updatedAfter: z
    .string()
    .datetime({ message: "updatedAfter must be a valid ISO 8601 datetime" })
    .optional(),

  cursor: z.string().max(200).optional(),

  format: z.enum(["geojson", "csv"]).default("geojson").optional(),

  dedupe: z.enum(["true", "false"]).optional(),
});

export type GetAlertsGeoQuery = z.infer<typeof getAlertsGeoQuerySchema>;
