import type { NextFunction, Request, Response } from "express";
import { getHazardsForGeoJson } from "../services/hazard.service.js";
import { toGeoJSONFeatureCollection } from "../utils/geojson.util.js";
import type { GetAlertsGeoQuery } from "../validators/alert.validator.js";
import type { HazardSeverity, HazardSeverityBand } from "@prisma/client";

/**
 * Returns hazards as a GeoJSON FeatureCollection.
 * Supports filtering by status (active/historical), date range, source, severity, and bounding box.
 */
export const getAlertsGeo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      status = "active",
      dateFrom,
      dateTo,
      source,
      severity,
      severityBands,
      categoryIds,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      limit: limitStr,
    }: GetAlertsGeoQuery = req.query;

    // Cap limit between 1 and 2000, default 500
    const rawLimit = limitStr ? parseInt(limitStr, 10) : 500;
    const limit = Math.max(1, Math.min(2000, rawLimit));

    // Map status to showExpired flag
    const showExpired = status === "historical";

    const { hazards, totalCount } = await getHazardsForGeoJson({
      showExpired,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      sourceIds: source,
      severities: severity as HazardSeverity[] | undefined,
      severityBands: severityBands as HazardSeverityBand[] | undefined,
      categoryIds,
      northeastLat: northeastLat ? Number(northeastLat) : undefined,
      northeastLng: northeastLng ? Number(northeastLng) : undefined,
      southwestLat: southwestLat ? Number(southwestLat) : undefined,
      southwestLng: southwestLng ? Number(southwestLng) : undefined,
      pageSize: limit,
    });

    const featureCollection = toGeoJSONFeatureCollection(
      hazards,
      totalCount,
      limit,
    );

    res.setHeader("Content-Type", "application/geo+json");
    res.json(featureCollection);
  } catch (error) {
    next(error);
  }
};
