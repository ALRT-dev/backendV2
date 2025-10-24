import { HazardSeverity, type Prisma } from "@prisma/client";
import { CONNREFUSED } from "dns";
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
 * Converts air quality data into an array of Hazard objects
 *
 * @param data - Array of air quality objects containing site information, pollutant data, and measurements
 * @param categoryId - The hazard category ID to associate with these air quality hazards
 * @returns Array of Prisma HazardCreateInput objects ready for database insertion
 *
 * @example
 * ```typescript
 * const airQualityData = [
 *   {
 *     "Site_Id": "33",
 *     "SiteName": "Randwick",
 *     "Longitude": "151.24278",
 *     "Latitude": "-33.93175",
 *     "Region": "East Sydney",
 *     "AirQualityCategory": "GOOD",
 *     "DeterminingPollutant": "PM2.5",
 *     // ... other fields
 *   }
 * ];
 * const hazards = parseAirQualityToHazards(airQualityData, categoryId);
 * ```
 */
export function parseAirQualityToHazards(
  data: any[],
  categoryId: string
): Prisma.HazardCreateInput[] {
  if (!Array.isArray(data) || !data.length) return [];

  return data
    .map((item: any) => {
      if (
        item.AirQualityCategory &&
        item.AirQualityCategory.trim() === "INACTIVE"
      ) {
        return null;
      }

      const title = `Air Quality Alert - ${item.SiteName}`;

      // Build comprehensive description using all relevant fields
      const descriptionParts: string[] = [];

      if (item.Region) descriptionParts.push(`Region: ${item.Region}`);
      if (item.AirQualityCategory)
        descriptionParts.push(
          `Air Quality Category: ${item.AirQualityCategory}`
        );
      if (item.DeterminingPollutant)
        descriptionParts.push(
          `Determining Pollutant: ${item.DeterminingPollutant}`
        );
      if (item.DeterminingPollutantValue)
        descriptionParts.push(
          `Pollutant Value: ${item.DeterminingPollutantValue}`
        );
      if (item.WDR) descriptionParts.push(`Wind Direction: ${item.WDR}°`);
      if (item.WSP) descriptionParts.push(`Wind Speed: ${item.WSP} km/h`);
      if (item.SiteType) descriptionParts.push(`Site Type: ${item.SiteType}`);
      if (item.SitePurpose)
        descriptionParts.push(`Site Purpose: ${item.SitePurpose}`);
      if (item.ContributeToNewRegionalAQC)
        descriptionParts.push(
          `Regional AQC: ${item.ContributeToNewRegionalAQC}`
        );
      if (item.HourDescription)
        descriptionParts.push(`Time Period: ${item.HourDescription}`);
      if (item.Date) descriptionParts.push(`Date: ${item.Date}`);

      const description = descriptionParts.join("\n");

      // Determine severity based on air quality category
      const severity = getAirQualitySeverity(item.AirQualityCategory);

      // Parse coordinates
      const latitude = item.Latitude ? parseFloat(item.Latitude) : null;
      const longitude = item.Longitude ? parseFloat(item.Longitude) : null;

      // Parse occurrence date from Date and Hour fields
      let occurredAt = new Date();
      if (item.Date && item.Hour) {
        try {
          const dateStr = `${item.Date}T${String(item.Hour).padStart(
            2,
            "0"
          )}:00:00`;
          occurredAt = new Date(dateStr);
          if (isNaN(occurredAt.getTime())) {
            occurredAt = new Date();
          }
        } catch {
          occurredAt = new Date();
        }
      }

      const id = item.Site_Id && `airquality-${item.Site_Id}`;

      const hazard: Prisma.HazardCreateInput = {
        id,
        title,
        description,
        category: {
          connect: { id: categoryId },
        },
        latitude,
        longitude,
        occurredAt,
        severity,
      };

      return hazard;
    })
    .filter((hazard): hazard is Prisma.HazardCreateInput => hazard !== null);
}

/**
 * Maps air quality category to hazard severity based on standard air quality classifications
 *
 * @param category - Air quality category string (e.g., "GOOD", "POOR", "HAZARDOUS")
 * @returns Corresponding HazardSeverity enum value
 *
 * Mapping:
 * - GOOD, FAIR → info
 * - POOR → advice
 * - VERY POOR → watchAndAct
 * - EXTREMELY POOR, HAZARDOUS → emergency
 */
function getAirQualitySeverity(category?: string): HazardSeverity {
  if (!category) return HazardSeverity.info;

  const normalizedCategory = category.toUpperCase();

  switch (normalizedCategory) {
    case "GOOD":
      return HazardSeverity.info;
    case "FAIR":
      return HazardSeverity.info;
    case "POOR":
      return HazardSeverity.advice;
    case "VERY POOR":
      return HazardSeverity.watchAndAct;
    case "EXTREMELY POOR":
      return HazardSeverity.emergency;
    case "HAZARDOUS":
      return HazardSeverity.emergency;
    default:
      return HazardSeverity.info;
  }
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
