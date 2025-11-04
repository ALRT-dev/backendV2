import { HazardSeverity, type Prisma } from "@prisma/client";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Point,
} from "geojson";
import Parser from "rss-parser";
import type { GeocodeResult } from "@googlemaps/google-maps-services-js";
import {
  convertAddressToLatLng,
  convertLatLngToAddress,
} from "../services/google_map.service.js";

/**
 * GEOCODING OPTIMIZATION UTILITIES:
 *
 * In-memory cache and rate limiting for Google Maps API calls
 * to reduce API usage from >5000 calls/month to <500 calls/month
 */

// In-memory cache for geocoding results to reduce API calls
const geocodingCache = new Map<
  string,
  { lat: number; lng: number; address: string; timestamp: number }
>();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for geocoding API calls
let lastGeocodingCall = 0;
const GEOCODING_DELAY_MS = 100; // 100ms delay between API calls

/**
 * Adds a delay to respect API rate limits
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Cleans up expired cache entries to prevent memory leaks
 */
export const cleanupGeocodingCache = (): void => {
  const now = Date.now();
  let deletedCount = 0;
  const keysToDelete: string[] = [];

  geocodingCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_EXPIRY_MS) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => {
    geocodingCache.delete(key);
    deletedCount++;
  });

  if (deletedCount > 0) {
    console.log(
      `Cleaned up ${deletedCount} expired geocoding cache entries. Current cache size: ${geocodingCache.size}`
    );
  }
};

/**
 * Rate-limited geocoding wrapper
 */
const rateLimitedGeocode = async <T>(
  geocodeFunction: () => Promise<T>
): Promise<T> => {
  const now = Date.now();
  const timeSinceLastCall = now - lastGeocodingCall;

  if (timeSinceLastCall < GEOCODING_DELAY_MS) {
    await delay(GEOCODING_DELAY_MS - timeSinceLastCall);
  }

  lastGeocodingCall = Date.now();
  return geocodeFunction();
};

/**
 * Gets the current geocoding cache size for monitoring
 */
export const getGeocodingCacheSize = (): number => {
  return geocodingCache.size;
};

/**
 * Populates a single hazard with missing geocoding information using cache when possible.
 * If latitude/longitude is missing, it uses the locationName to fetch coordinates.
 * If locationName is missing, it uses latitude/longitude to fetch the address.
 */
export const populateHazardWithGeocoding = async (
  hazard: Prisma.HazardCreateInput
): Promise<Prisma.HazardCreateInput> => {
  // Skip geocoding if both coordinates and location are already present
  if (hazard.latitude && hazard.longitude && hazard.locationName) {
    return hazard;
  }

  try {
    // Case 1: Missing coordinates but have location name
    if (!hazard.latitude || !hazard.longitude) {
      if (hazard.locationName) {
        const cacheKey = `addr_${hazard.locationName}`;
        const cached = geocodingCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
          hazard.latitude = cached.lat;
          hazard.longitude = cached.lng;
          console.log(`Using cached coordinates for: ${hazard.locationName}`);
        } else {
          const result: GeocodeResult | undefined = await rateLimitedGeocode(
            () => convertAddressToLatLng(hazard.locationName!)
          );
          if (result && result.geometry && result.geometry.location) {
            hazard.latitude = result.geometry.location.lat;
            hazard.longitude = result.geometry.location.lng;

            // Cache the result
            geocodingCache.set(cacheKey, {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
              address: hazard.locationName,
              timestamp: Date.now(),
            });
            console.log(`Geocoded coordinates for: ${hazard.locationName}`);
          } else {
            console.warn(
              `Geocoding failed for hazard location: ${hazard.locationName}`
            );
          }
        }
      }
    }

    // Case 2: Missing location name but have coordinates
    if (hazard.latitude && hazard.longitude && !hazard.locationName) {
      const cacheKey = `coords_${hazard.latitude}_${hazard.longitude}`;
      const cached = geocodingCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        hazard.locationName = cached.address;
        console.log(
          `Using cached address for: ${hazard.latitude}, ${hazard.longitude}`
        );
      } else {
        const address: string | undefined = await rateLimitedGeocode(() =>
          convertLatLngToAddress(hazard.latitude!, hazard.longitude!)
        );
        if (address) {
          hazard.locationName = address;

          // Cache the result
          geocodingCache.set(cacheKey, {
            lat: hazard.latitude,
            lng: hazard.longitude,
            address: address,
            timestamp: Date.now(),
          });
          console.log(
            `Reverse geocoded address for: ${hazard.latitude}, ${hazard.longitude}`
          );
        } else {
          console.warn(
            `Reverse geocoding failed for hazard coordinates: ${hazard.latitude}, ${hazard.longitude}`
          );
        }
      }
    }

    return hazard;
  } catch (error) {
    console.error(`Error during geocoding for hazard: ${hazard.title}`, error);
    return hazard;
  }
};

/**
 * Converts GeoJSON FeatureCollection to an array of Hazard objects
 *
 * @param data - The GeoJSON FeatureCollection
 * @param categoryId - The hazard category ID to associate with these hazards
 * @returns Array of Prisma HazardCreateInput objects ready for database insertion
 *
 * @example
 * ```typescript
 * const geoJsonData = {
 *   "type": "FeatureCollection",
 *   "features": [
 *     {
 *       "type": "Feature",
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [151.2093, -33.8688]
 *       },
 *       "properties": {
 *         "title": "Flood Warning",
 *         "description": "<p>Heavy rains expected...</p>",
 *         "pubDate": "2023-10-01T10:00:00+10:00"
 *       }
 *     }
 *   ]
 * };
 * const hazards = parseGeoJsonToHazards(geoJsonData, categoryId);
 * ```
 */
export function parseGeoJsonToHazards(
  data: FeatureCollection,
  categoryId: string,
  idPrefix: string = "geojson"
): Prisma.HazardCreateInput[] {
  if (!data.features?.length) return [];

  return data.features
    .map((feature) => {
      const { id, properties, geometry } = feature;

      const point = extractFirstPoint(geometry);
      const latitude = point?.[1] ?? null;
      const longitude = point?.[0] ?? null;

      // If no coordinates, skip this hazard
      if (!latitude && !longitude) {
        return null;
      }

      const title =
        properties?.title || properties?.displayName || "Untitled Hazard";

      const description = cleanDescription(
        properties?.description || properties?.otherAdvice || ""
      );

      const hazardId = id && `${idPrefix}-${id}`;

      const hazard: Prisma.HazardCreateInput = {
        ...(hazardId && { id: hazardId }),
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
    })
    .filter((hazard): hazard is Prisma.HazardCreateInput => hazard !== null);
}

/**
 * Converts the BoM weather warnings JSON into an array of Hazard objects
 *
 * @param data - The BoM warnings JSON object
 * @param categoryId - The hazard category ID to associate with these warnings
 * @returns Array of Prisma HazardCreateInput objects ready for database insertion
 *
 * @example
 * ```typescript
 * const bomWarningsData = {
 *   "results": [
 *     {
 *       "warning_title": "Severe Thunderstorm Warning",
 *       "summary": "<p>Severe thunderstorms are expected...</p>",
 *       "begin_time": "2023-10-01T14:00:00+10:00",
 *       "end_time": "2023-10-01T16:00:00+10:00"
 *     }
 *   ]
 * };
 * const hazards = parseBoMWarningsToHazards(bomWarningsData, categoryId);
 * ```
 */
export function parseBoMWarningsToHazards(
  data: any,
  categoryId: string
): Prisma.HazardCreateInput[] {
  if (!data?.results?.length) return [];

  return data.results.map((item: any) => {
    const description = cleanDescription(
      item.summary || item.warning_title || ""
    );
    const id = item.identifier && `bom-${item.identifier}`;

    const hazard: Prisma.HazardCreateInput = {
      id,
      title: item.warning_title || "Unnamed Warning",
      description,
      locationName: item.location,
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
      // Determine severity based on air quality category
      const severity = getAirQualitySeverity(item.AirQualityCategory);

      // Only create hazards for significant air quality issues i.e (POOR, VERY POOR, EXTREMELY POOR, HAZARDOUS)
      if (
        severity !== HazardSeverity.emergency &&
        severity !== HazardSeverity.watchAndAct &&
        severity !== HazardSeverity.advice
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
 * Converts RSS feed XML string to an array of Hazard objects
 *
 * @param xmlString - The RSS XML string to parse
 * @param categoryId - The hazard category ID to associate with these RSS feed hazards
 * @returns Promise that resolves to array of Prisma HazardCreateInput objects
 *
 * @example
 * ```typescript
 * const rssXml = `
 * <rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
 *   <channel>
 *     <title>Country Fire Service - South Australia - Current Incidents</title>
 *     <item>
 *       <title>RANGE ROAD, WAITPINGA (Tree Down)</title>
 *       <identifier>1668093</identifier>
 *       <description>First Reported: Sunday, 26 Oct 2025 16:03:00<br>Status: GOING<br>Region: 1</description>
 *       <pubDate>Sun, 26 Oct 2025 16:23:04 +1030</pubDate>
 *     </item>
 *   </channel>
 * </rss>
 * `;
 * const hazards = await parseRSSFeedToHazards(rssXml, categoryId);
 * ```
 */
export async function parseRSSFeedToHazards(
  url: string,
  categoryId: string,
  idPrefix: string = "rss"
): Promise<Prisma.HazardCreateInput[]> {
  const parser = new Parser({
    customFields: {
      item: [
        "identifier",
        "description",
        "georss:point",
        "id",
        "published",
        "category",
      ],
    },
  });
  const feed = await parser.parseURL(url);

  if (!feed.items?.length) return [];

  return feed.items.map((item) => {
    const title = cleanRSSTitle(item.title || "Untitled Incident");
    let description = cleanDescription(item.content || item.description || "");

    const alertLevel = item.category?.$?.term;
    if (alertLevel && alertLevel.trim() !== "") {
      description = `Alert Level: ${alertLevel}\n${description}`;
    }

    const { latitude, longitude } = extractRSSCoordinates(item);

    const id =
      (item.identifier && `${idPrefix}-${item.identifier}`) ||
      (item.guid && `${idPrefix}-${cleanGUID(item.guid)}`) ||
      (item.id && `${idPrefix}-${item.id}`);

    const hazard: Prisma.HazardCreateInput = {
      id,
      title,
      description,
      category: {
        connect: { id: categoryId },
      },
      latitude,
      longitude,
      occurredAt: parseValidDate(item.pubDate),
    };

    return hazard;
  });
}

/**
 * Converts CFS (Country Fire Service) incident data into an array of Hazard objects
 *
 * @param data - Array of CFS incident objects
 * @param categoryId - The hazard category ID to associate with these incidents
 * @returns Array of Prisma HazardCreateInput objects ready for database insertion
 *
 * @example
 * ```typescript
 * const cfsData = [
 *   {
 *     "IncidentNo": "1668253",
 *     "Date": "27/10/2025",
 *     "Time": "17:17",
 *     "Type": "Vehicle Accident",
 *     "Status": "GOING",
 *     "Level": 1,
 *     "Location_name": "MUNNO PARA DOWNS, STEBONHEATH RD/DALKEITH RD",
 *     "Location": "-34.6420957116545,138.688921293742"
 *   }
 * ];
 * const hazards = parseCFSFeedToHazards(cfsData, categoryId);
 * ```
 */
export function parseCFSFeedToHazards(
  data: any[],
  categoryId: string
): Prisma.HazardCreateInput[] {
  if (!Array.isArray(data) || !data.length) return [];

  return data.filter(Boolean).map((incident) => {
    const { IncidentNo, Date, Time, Location_name, Type, Location } = incident;

    // Parse coordinates from Location field (format: "lat,lng")
    const coordinates = parseLocationCoordinates(Location);

    // Create date from Date and Time fields
    const occurredAt = parseCFSIncidentDateTime(Date, Time);

    // Create title from incident type and location
    const title = `${Type || "Incident"} - ${
      Location_name || "Unknown Location"
    }`;

    // Build description with available details
    const description = buildCFSDescription(incident);

    // Generate unique ID for the incident
    const hazardId = IncidentNo && `cfs-${IncidentNo}`;

    const hazard: Prisma.HazardCreateInput = {
      id: hazardId,
      title,
      description,
      category: {
        connect: { id: categoryId },
      },
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      occurredAt,
    };

    return hazard;
  });
}

/**
 * Converts NT Fire and Rescue incident data into an array of Hazard objects
 *
 * @param data - NT Fire and Rescue response object containing incidents FeatureCollection
 * @param categoryId - The hazard category ID to associate with these incidents
 * @returns Array of Prisma HazardCreateInput objects ready for database insertion
 *
 * @example
 * ```typescript
 * const ntFireData = {
 *   "title": "NT Incident Map",
 *   "lastupdated": "2025-10-30T21:30:02.2119132+09:30",
 *   "incidents": {
 *     "type": "FeatureCollection",
 *     "features": [
 *       {
 *         "type": "Feature",
 *         "geometry": {
 *           "type": "Point",
 *           "coordinates": [130.83513366511, -12.45823778393]
 *         },
 *         "properties": {
 *           "_category": "fire",
 *           "_status": "active",
 *           "_eventtype": "Grass and Scrub Fire",
 *           "_location": "BAGOT RD, EATON",
 *           "_datenotified": "2025-10-30T18:50:31+09:30",
 *           "Alert Level": "Advice"
 *         }
 *       }
 *     ]
 *   }
 * };
 * const hazards = parseNTFireToHazards(ntFireData, categoryId);
 * ```
 */
export function parseNTFireAndRescueToHazards(
  data: any,
  categoryId: string
): Prisma.HazardCreateInput[] {
  if (!data?.incidents?.features?.length) return [];

  return data.incidents.features
    .map((feature: Feature<Geometry, GeoJsonProperties>) => {
      const { geometry, properties } = feature;

      if (properties?._status === "closed") {
        return null;
      }

      // Extract coordinates from geometry
      const coordinates = extractNTFireAndRescueCoordinates(geometry);

      // Create unique ID from internal properties
      const hazardId = generateNTFireAndRescueId(properties);

      // Create title from event type and location
      const title = `${
        properties?._eventtype || properties?.["Fire Type"] || "Incident"
      } - ${
        properties?._location || properties?.Location || "Unknown Location"
      }`;

      // Build description with available details
      const description = buildNTFireAndRescueDescription(properties);

      // Parse notification date
      const occurredAt = parseValidDate(
        properties?._datenotified || properties?.Notified
      );

      // Parse closed date for expiry if available
      const expiresAt = properties?._dateclosed
        ? parseValidDate(properties._dateclosed)
        : null;

      const hazard: Prisma.HazardCreateInput = {
        ...(hazardId && { id: hazardId }),
        title,
        description,
        locationName:
          properties?._location || properties?.Location || undefined,
        category: {
          connect: { id: categoryId },
        },
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        occurredAt,
        expiresAt,
      };

      return hazard;
    })
    .filter(
      (
        hazard: Prisma.HazardCreateInput | null
      ): hazard is Prisma.HazardCreateInput => hazard !== null
    );
}

// ------------------------------------------------------------------------------------------------------------------------------------- HELPERS

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
 * Extracts ID from GUID URLs or cleans GUID by removing HTML tags and trimming whitespace
 *
 * @param guid - The GUID string which may contain URLs with IDs
 * @returns Extracted ID from URL or cleaned GUID string
 *
 * @example
 * extractIdFromGUID("http://emergency.vic.gov.au/respond/#!/incident/242688/moreinfo") // returns "242688"
 * extractIdFromGUID("https://data.eso.sa.gov.au/prod/cfs/criimson/1668103") // returns "1668103"
 * extractIdFromGUID("some-plain-guid") // returns "some-plain-guid"
 */
function cleanGUID(guid: string): string {
  // First clean HTML tags
  const cleaned = guid
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  // Try to extract ID from URL patterns
  // Pattern 1: http://emergency.vic.gov.au/respond/#!/incident/242688/moreinfo
  const vicGovMatch = cleaned.match(/\/incident\/(\d+)/);
  if (vicGovMatch && vicGovMatch[1]) {
    return vicGovMatch[1];
  }

  // Pattern 2: https://data.eso.sa.gov.au/prod/cfs/criimson/1668103
  const saGovMatch = cleaned.match(/\/criimson\/(\d+)/);
  if (saGovMatch && saGovMatch[1]) {
    return saGovMatch[1];
  }

  // General pattern: extract last numeric segment from URL path
  const urlMatch = cleaned.match(/https?:\/\/[^\/]+\/.*\/(\d+)(?:\/|$)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // If no URL pattern matches, return the cleaned string
  return cleaned;
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

/**
 * Cleans RSS title by extracting the main incident description
 * and removing location prefixes if they seem redundant
 */
function cleanRSSTitle(title: string): string {
  if (!title) return "Untitled Incident";

  // If title contains parentheses, extract the content in parentheses as the main title
  const parenthesesMatch = title.match(/\(([^)]+)\)$/);
  if (parenthesesMatch) {
    const incidentType = parenthesesMatch[1];
    const location = title.replace(/\s*\([^)]+\)$/, "").trim();
    return `${incidentType} - ${location}`;
  }

  return title.trim();
}

/**
 * Extracts latitude and longitude coordinates from RSS feed items
 *
 * This function handles multiple coordinate sources:
 * 1. GeoRSS point tags (e.g., <georss:point>-35.3872755399 149.0929348399</georss:point>)
 * 2. Coordinates embedded in description text (e.g., Latitude: -37.81758764384293, Longitude: 144.67545946890297)
 *
 * @param item - RSS feed item object from rss-parser
 * @returns Object containing latitude and longitude as numbers, or null values if not found
 *
 * @example
 * ```typescript
 * const rssItem = {
 *   title: "Fire Alert",
 *   description: "<strong>Latitude:</strong> -37.81758764384293<br><strong>Longitude:</strong> 144.67545946890297<br>",
 *   'georss:point': "-35.3872755399 149.0929348399"
 * };
 *
 * const coords = extractRSSCoordinates(rssItem);
 * // Returns: { latitude: -35.3872755399, longitude: 149.0929348399 }
 * ```
 */
export function extractRSSCoordinates(item: any): {
  latitude: number | null;
  longitude: number | null;
} {
  let latitude: number | null = null;
  let longitude: number | null = null;

  // Method 1: Check for GeoRSS point tag
  // Format: <georss:point xmlns:georss="http://www.georss.org/georss">lat lon</georss:point>
  const georssPoint = item["georss:point"] || item.georss?.point;
  if (georssPoint && typeof georssPoint === "string") {
    const coords = georssPoint.trim().split(/\s+/);
    if (coords.length === 2 && coords[0] && coords[1]) {
      const lat = parseFloat(coords[0]);
      const lon = parseFloat(coords[1]);

      if (!isNaN(lat) && !isNaN(lon)) {
        latitude = lat;
        longitude = lon;
        return { latitude, longitude };
      }
    }
  }

  // Method 2: Extract from description text
  // Look for patterns like "Latitude: -37.81758764384293" and "Longitude: 144.67545946890297"
  const description = item.description || item.content || "";
  if (typeof description === "string") {
    // Match latitude pattern (case insensitive)
    const latMatch =
      description.match(/<strong>Latitude:<\/strong>\s*(-?\d+\.?\d*)/i) ||
      description.match(/Latitude:\s*(-?\d+\.?\d*)/i) ||
      description.match(/lat:\s*(-?\d+\.?\d*)/i);

    // Match longitude pattern (case insensitive)
    const lonMatch =
      description.match(/<strong>Longitude:<\/strong>\s*(-?\d+\.?\d*)/i) ||
      description.match(/Longitude:\s*(-?\d+\.?\d*)/i) ||
      description.match(/lon:\s*(-?\d+\.?\d*)/i) ||
      description.match(/lng:\s*(-?\d+\.?\d*)/i);

    if (latMatch && latMatch[1] && lonMatch && lonMatch[1]) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);

      if (!isNaN(lat) && !isNaN(lon)) {
        latitude = lat;
        longitude = lon;
      }
    }
  }

  return { latitude, longitude };
}

/**
 * Parses location coordinates from Location field
 * @param location - Location string in format "lat,lng"
 * @returns Object with latitude and longitude or null values
 */
function parseLocationCoordinates(location?: string): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!location || typeof location !== "string") {
    return { latitude: null, longitude: null };
  }

  const parts = location.split(",");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { latitude: null, longitude: null };
  }

  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());

  if (isNaN(lat) || isNaN(lng)) {
    return { latitude: null, longitude: null };
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Parses CFS date and time into a JavaScript Date object
 * @param date - Date string in DD/MM/YYYY format
 * @param time - Time string in HH:MM format
 * @returns Date object
 */
function parseCFSIncidentDateTime(date?: string, time?: string): Date {
  if (!date) {
    return new Date();
  }

  let dateTimeString = date;
  if (time) {
    dateTimeString += ` ${time}`;
  }

  return parseValidDate(dateTimeString);
}

/**
 * Builds a descriptive text for CFS incidents
 * @param incident - CFS incident object
 * @returns Formatted description string
 */
function buildCFSDescription(incident: any): string {
  const parts: string[] = [];

  if (incident.Type) {
    parts.push(`Incident Type: ${incident.Type}`);
  }

  if (incident.Status) {
    parts.push(`Status: ${incident.Status}`);
  }

  if (incident.Level) {
    parts.push(`Level: ${incident.Level}`);
  }

  if (incident.FBD) {
    parts.push(`Fire Ban District: ${incident.FBD}`);
  }

  if (incident.Region) {
    parts.push(`Region: ${incident.Region}`);
  }

  if (incident.Resources) {
    parts.push(`Resources: ${incident.Resources}`);
  }

  if (incident.Aircraft) {
    parts.push(`Aircraft: ${incident.Aircraft}`);
  }

  if (incident.Message && incident.Message.trim()) {
    parts.push(`Message: ${incident.Message.trim()}`);
  }

  return parts.join("\n");
}

/**
 * Extracts coordinates from NT Fire geometry (supports Point and Polygon)
 * @param geometry - GeoJSON geometry object
 * @returns Object with latitude and longitude or null values
 */
function extractNTFireAndRescueCoordinates(geometry?: any): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!geometry?.coordinates) {
    return { latitude: null, longitude: null };
  }

  try {
    if (geometry.type === "Point") {
      const [lng, lat] = geometry.coordinates;
      return {
        latitude: typeof lat === "number" ? lat : null,
        longitude: typeof lng === "number" ? lng : null,
      };
    } else if (geometry.type === "Polygon") {
      // For polygons, use the centroid of the first ring
      const ring = geometry.coordinates[0];
      if (Array.isArray(ring) && ring.length > 0) {
        let latSum = 0;
        let lngSum = 0;
        let validPoints = 0;

        for (const point of ring) {
          if (Array.isArray(point) && point.length >= 2) {
            const [lng, lat] = point;
            if (typeof lng === "number" && typeof lat === "number") {
              lngSum += lng;
              latSum += lat;
              validPoints++;
            }
          }
        }

        if (validPoints > 0) {
          return {
            latitude: latSum / validPoints,
            longitude: lngSum / validPoints,
          };
        }
      }
    }
  } catch (error) {
    console.warn("Error parsing NT Fire coordinates:", error);
  }

  return { latitude: null, longitude: null };
}

/**
 * Generates a unique ID for NT Fire incidents
 * @param properties - Feature properties object
 * @returns Generated ID string or undefined
 */
function generateNTFireAndRescueId(properties: any): string | undefined {
  // Try to create a unique ID from available properties
  const location = properties._location || properties.Location || "";
  const eventType = properties._eventtype || properties["Fire Type"] || "";
  const dateNotified = properties._datenotified || properties.Notified || "";

  if (location && eventType && dateNotified) {
    // Create a hash-like ID from key properties
    const identifier = `${eventType}-${location}-${dateNotified}`
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    return `ntfire-${identifier.substring(0, 50)}`; // Limit length
  }

  return undefined;
}

/**
 * Builds a descriptive text for NT Fire incidents
 * @param properties - Feature properties object
 * @returns Formatted description string
 */
function buildNTFireAndRescueDescription(properties: any): string {
  const parts: string[] = [];

  // Basic incident information
  if (properties._eventtype || properties["Fire Type"]) {
    parts.push(
      `Event Type: ${properties._eventtype || properties["Fire Type"]}`
    );
  }

  if (properties._status || properties.Status) {
    parts.push(`Status: ${properties._status || properties.Status}`);
  }

  if (properties["Alert Level"]) {
    parts.push(`Alert Level: ${properties["Alert Level"]}`);
  }

  if (properties["Current Situation"]) {
    parts.push(`Current Situation: ${properties["Current Situation"]}`);
  }

  // Risk and advice information
  if (properties.Risks) {
    parts.push(`Risks: ${properties.Risks}`);
  }

  if (properties["What to do"]) {
    parts.push(`What to do: ${properties["What to do"]}`);
  }

  if (properties["Advice to the Public"]) {
    parts.push(`Advice: ${properties["Advice to the Public"]}`);
  }

  // Agency and timing information
  if (properties["Responsible Agency"]) {
    parts.push(`Responsible Agency: ${properties["Responsible Agency"]}`);
  }

  if (properties["Last Update"]) {
    parts.push(`Last Update: ${properties["Last Update"]}`);
  }

  if (properties.Notified) {
    parts.push(`Notified: ${properties.Notified}`);
  }

  if (properties.Closed) {
    parts.push(`Closed: ${properties.Closed}`);
  }

  return parts.join("\n");
}
