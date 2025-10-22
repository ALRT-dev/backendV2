import { HazardSeverity, type Prisma } from "@prisma/client";
import type { FeatureCollection, Geometry, Point } from "geojson";

/**
 * Converts GeoJSON FeatureCollection to an array of Hazard objects
 */
export function parseGeoJsonToHazards(
  data: FeatureCollection,
  categoryId: string
): Prisma.HazardCreateInput[] {
  if (!data.features?.length) return [];

  return data.features.map((feature) => {
    const { properties, geometry } = feature;

    const point = extractFirstPoint(geometry);
    const latitude = point?.[1] ?? null;
    const longitude = point?.[0] ?? null;

    const title =
      properties?.title || properties?.displayName || "Untitled Hazard";
    const description = cleanDescription(
      properties?.description || properties?.otherAdvice || ""
    );

    const hazard: Prisma.HazardCreateInput = {
      title,
      description,
      category: {
        connect: { id: categoryId },
      },
      latitude,
      longitude,
      occurredAt: parseValidDate(properties?.pubDate),
    };

    return hazard;
  });
}

/**
 * Converts the BoM weather warnings JSON into an array of Hazard objects
 */
export function parseBoMWarningsToHazards(
  data: any,
  categoryId: string
): Prisma.HazardCreateInput[] {
  if (!data?.results?.length) return [];

  return data.results.map((item: any) => {
    const description = cleanDescription(item.summary || "");
    const hazard: Prisma.HazardCreateInput = {
      title: item.warning_title || "Unnamed Warning",
      description,
      category: {
        connect: { id: categoryId },
      },
      occurredAt: parseValidDate(item.begin_time),
      expiresAt: item.end_time ? parseValidDate(item.end_time) : null,
    };

    return hazard;
  });
}

/**
 * Removes HTML tags and converts <br> to line breaks
 */
function cleanDescription(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Recursively extracts the first Point coordinates from any GeometryCollection
 */
function extractFirstPoint(geometry: Geometry): number[] | null {
  if (geometry.type === "Point") {
    return (geometry as Point).coordinates;
  }
  if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries) {
      const point = extractFirstPoint(g as Geometry);
      if (point) return point;
    }
  }
  return null;
}

/**
 * Safely parses a date string or returns current date if invalid
 */
function parseValidDate(dateInput?: string | number | Date): Date {
  if (!dateInput) {
    return new Date();
  }

  // If it's already a Date object, return it
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }

  // If it's a number, treat it as timestamp
  if (typeof dateInput === "number") {
    const parsedDate = new Date(dateInput);
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }

  // Handle string input
  let parsedDate = new Date(dateInput);

  // If the standard Date parsing fails, try to handle DD/MM/YYYY format
  if (isNaN(parsedDate.getTime())) {
    // Check if it matches DD/MM/YYYY format (with optional time)
    const ddmmyyyyMatch = dateInput.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/
    );
    if (ddmmyyyyMatch) {
      const [, day, month, year, timepart] = ddmmyyyyMatch;
      // Rearrange to MM/DD/YYYY format for JavaScript Date constructor
      const reformattedDate = `${month}/${day}/${year}${timepart}`;
      parsedDate = new Date(reformattedDate);
    }
  }

  // Check if the date is valid
  if (isNaN(parsedDate.getTime())) {
    return new Date(); // Return current date if invalid
  }

  return parsedDate;
}
