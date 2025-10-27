import { HazardSeverity, type Prisma } from "@prisma/client";
import type { FeatureCollection, Geometry, Point } from "geojson";
import Parser from "rss-parser";

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

  return data.features.map((feature) => {
    const { id, properties, geometry } = feature;

    const point = extractFirstPoint(geometry);
    const latitude = point?.[1] ?? null;
    const longitude = point?.[0] ?? null;

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
  });
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
      item: ["identifier", "description", "georss:point", "id", "published"],
    },
  });
  const feed = await parser.parseURL(url);

  if (!feed.items?.length) return [];

  return feed.items.map((item) => {
    const title = cleanRSSTitle(item.title || "Untitled Incident");
    const description = cleanDescription(
      item.content || item.description || ""
    );

    const severity = determineRSSSeverity(description, title);

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
      severity,
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
 * Determines hazard severity based on RSS content
 */
function determineRSSSeverity(
  description: string,
  title: string
): HazardSeverity {
  const content = `${description} ${title}`.toLowerCase();

  // Emergency indicators
  if (
    content.includes("emergency") ||
    content.includes("evacuation") ||
    content.includes("immediate threat") ||
    content.includes("life threatening")
  ) {
    return HazardSeverity.emergency;
  }

  // Watch and Act indicators
  if (
    content.includes("watch and act") ||
    content.includes("prepare to evacuate") ||
    content.includes("going") ||
    content.includes("out of control")
  ) {
    return HazardSeverity.watchAndAct;
  }

  // Advice level indicators
  if (
    content.includes("advice") ||
    content.includes("monitor") ||
    content.includes("tree down") ||
    content.includes("road closure")
  ) {
    return HazardSeverity.advice;
  }

  // Default to info for general incidents
  return HazardSeverity.info;
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
