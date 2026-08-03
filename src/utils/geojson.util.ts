export interface GeoJSONFeature {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  bbox?: [number, number, number, number];
  features: GeoJSONFeature[];
  metadata: {
    totalCount: number;
    limit: number;
    truncated: boolean;
    nextCursor?: string | null;
  };
}

/**
 * Transforms hazard rows into a GeoJSON FeatureCollection.
 * Coordinates use RFC 7946 [longitude, latitude] order.
 */
export function toGeoJSONFeatureCollection(
  hazards: any[],
  totalCount: number,
  limit: number,
  nextCursor?: string | null,
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = hazards
    .filter((h) => h.latitude != null && h.longitude != null)
    .map((h) => ({
      type: "Feature" as const,
      id: h.id,
      geometry: {
        type: "Point" as const,
        coordinates: [h.longitude, h.latitude] as [number, number],
      },
      properties: {
        id: h.id,
        title: h.title,
        description: h.description,
        aiSummary: h.aiSummary ?? null,
        severity: h.severity,
        severityBand: h.severityBand,
        reviewStatus: h.reviewStatus,
        confidenceScore: h.confidenceScore ?? null,
        locationName: h.locationName ?? null,
        fireStatus: h.fireStatus ?? null,
        callsToAction: h.callsToAction ?? [],
        isAwsCompliant: h.isAwsCompliant,
        externalId: h.externalId ?? null,
        categoryId: h.categoryId ?? null,
        categoryName: h.categoryName ?? null,
        categoryColor: h.categoryColor ?? null,
        sourceId: h.sourceId ?? null,
        sourceName: h.sourceName ?? null,
        sourceUrl: h.sourceUrl ?? null,
        sourceCopyrightText: h.sourceCopyrightText ?? null,
        sourceCopyrightLink: h.sourceCopyrightLink ?? null,
        sourceLicenseBadge: h.sourceLicenseBadge ?? null,
        sourceLicenseLink: h.sourceLicenseLink ?? null,
        duplicateIds: h.duplicateIds ?? null,
        boundingBox:
          h.northeastLat != null
            ? {
                north: h.northeastLat,
                south: h.southwestLat,
                east: h.northeastLng,
                west: h.southwestLng,
              }
            : null,
        occurredAt: h.occurredAt ?? null,
        expiresAt: h.expiresAt ?? null,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      },
    }));

  // Compute bounding box from result set per GeoJSON spec: [west, south, east, north]
  let bbox: [number, number, number, number] | undefined;
  if (features.length > 0) {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    bbox = [west, south, east, north];
  }

  return {
    type: "FeatureCollection",
    ...(bbox && { bbox }),
    features,
    metadata: {
      totalCount,
      limit,
      truncated: totalCount > limit,
      ...(nextCursor !== undefined && { nextCursor }),
    },
  };
}
