import type { NextFunction, Request, Response } from "express";
import { getHazardsForGeoJson } from "../services/hazard.service.js";
import { toGeoJSONFeatureCollection } from "../utils/geojson.util.js";
import { toHazardsCsv } from "../utils/export_csv.util.js";
import { dedupeHazardsForExport } from "../utils/export_dedup.util.js";
import { HttpError } from "../models/http_error.js";
import type { GetAlertsGeoQuery } from "../validators/alert.validator.js";
import type {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
} from "@prisma/client";

const encodeCursor = (updatedAt: Date, id: string): string =>
  Buffer.from(`${updatedAt.toISOString()}|${id}`).toString("base64url");

const decodeCursor = (
  cursor: string,
): { cursorUpdatedAt: Date; cursorId: string } => {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const separatorIndex = decoded.indexOf("|");
  const cursorUpdatedAt = new Date(decoded.slice(0, separatorIndex));
  const cursorId = decoded.slice(separatorIndex + 1);
  if (separatorIndex === -1 || isNaN(cursorUpdatedAt.getTime()) || !cursorId) {
    throw new HttpError(400, "Invalid cursor");
  }
  return { cursorUpdatedAt, cursorId };
};

/**
 * Returns hazards as a GeoJSON FeatureCollection or CSV.
 * Supports filtering by status (active/historical), date range, source,
 * severity, and bounding box, plus incremental pulls (updatedAfter),
 * keyset cursor pagination, and export-time cross-source deduplication.
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
      updatedAfter,
      cursor,
      format = "geojson",
      dedupe,
    }: GetAlertsGeoQuery = req.query;

    // Cap limit between 1 and 2000, default 500
    const rawLimit = limitStr ? parseInt(limitStr, 10) : 500;
    const limit = Math.max(1, Math.min(2000, rawLimit));

    // Map status to showExpired flag
    const showExpired = status === "historical";

    const cursorParams = cursor ? decodeCursor(cursor) : undefined;

    // Cursor pagination and incremental pulls need a deterministic order;
    // CSV exports use it too so paged files stitch together cleanly.
    const stableOrder = Boolean(cursor || updatedAfter || format === "csv");

    // External API-key consumers only ever see publicly shareable data —
    // the same accepted-only rule the public share pages enforce.
    const isExportApiKeyClient = res.locals.isExportApiKeyClient === true;

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
      updatedAfter: updatedAfter ? new Date(updatedAfter) : undefined,
      cursorUpdatedAt: cursorParams?.cursorUpdatedAt,
      cursorId: cursorParams?.cursorId,
      stableOrder,
      reviewStatus: isExportApiKeyClient
        ? ("accepted" as HazardReviewStatus)
        : undefined,
    });

    // nextCursor is only meaningful under stable ordering; a full page
    // signals there may be more rows.
    let nextCursor: string | null | undefined;
    if (stableOrder) {
      const lastRow = hazards[hazards.length - 1];
      nextCursor =
        hazards.length === limit && lastRow
          ? encodeCursor(new Date(lastRow.updatedAt), lastRow.id)
          : null;
    }

    const rows = dedupe === "true" ? dedupeHazardsForExport(hazards) : hazards;

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="alrt-hazards-export.csv"',
      );
      if (nextCursor) {
        res.setHeader("X-Next-Cursor", nextCursor);
      }
      res.send(toHazardsCsv(rows));
      return;
    }

    const featureCollection = toGeoJSONFeatureCollection(
      rows,
      totalCount,
      limit,
      nextCursor,
    );

    res.setHeader("Content-Type", "application/geo+json");
    res.json(featureCollection);
  } catch (error) {
    next(error);
  }
};
