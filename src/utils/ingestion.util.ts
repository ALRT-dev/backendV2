import {
  FireStatus,
  HazardSeverity,
  HazardSeverityBand,
  Prisma,
  type HazardCategory,
} from "@prisma/client";
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
import {
  awsCompliantSeverities,
  getSeverityBandFromAQI,
  getSeverityBandFromAWSCompliantSeverity,
  getSeverityBandFromDescription,
  getSeverityBandFromPollenCount,
  getSeverityBandFromSmartravellerLevel,
  getSeverityBandFromUVIndex,
  getSeverityFromDescription,
} from "./ingestion.severity.util.js";
import {
  awsCompliantCategoryIds,
  getCategoryFromDescription,
  getFireStatusFromDescription,
} from "./ingestion.category.util.js";
import type { HazardDataWithRelations } from "../models/hazard_data_with_relations_interface.js";
import { MainCategoryId } from "../services/hazard_category.service.js";
import {
  ExternalSourceId,
  getLocationsFromText,
} from "../services/ingestion.service.js";
import {
  AustralianStatesShort,
  type AustralianStates,
} from "../enums/australian_state_types.js";

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
export function parseGeoJsonToHazards({
  data,
  availableCategories,
  idPrefix = "geojson",
  dateFormat = "MM/DD/YYYY",
}: {
  data: FeatureCollection;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
  idPrefix: string;
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY";
}): HazardDataWithRelations[] {
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

      const description =
        idPrefix === ExternalSourceId.nswTransport
          ? extractNSWTrafficDescription(properties)
          : cleanDescription(
              properties?.description || properties?.otherAdvice || title
            );

      const hazardId =
        (id && `${idPrefix}-${id}`) ||
        (properties?.guid &&
          extractIdFromGUID(properties.guid) &&
          `${idPrefix}-${extractIdFromGUID(properties.guid)}`);

      const link = properties?.webLinks?.[0]?.linkURL;

      const mainCategory =
        properties?.mainCategory && properties?.mainCategory !== "null"
          ? properties.mainCategory
          : null;
      const subCategory =
        properties?.subCategoryA && properties?.subCategoryA !== "null"
          ? properties.subCategoryA
          : null;

      const { severity, severityBand, category, fireStatus, isAwsCompliant } =
        getHazardAttributesFromDescription(description, availableCategories);

      let finalCategory = category;
      // If mainCategory or subCategory is provided, try to refine the category from them
      if (mainCategory || subCategory) {
        const mainSubCatDesc = `${mainCategory}${
          subCategory ? ` - ${subCategory}` : ""
        }`;
        console.log(
          "---> Refining category based on main/sub category:",
          mainSubCatDesc
        );
        const obtainedCategory = getCategoryFromDescription(
          mainSubCatDesc,
          availableCategories
        );
        if (obtainedCategory && obtainedCategory.id !== MainCategoryId.other) {
          finalCategory = obtainedCategory;
        }
      }

      const hazard: HazardDataWithRelations = {
        ...(hazardId && { id: hazardId }),
        title,
        description,
        severity,
        severityBand,
        category: finalCategory,
        ...(finalCategory.isFireRelated && {
          fireStatus: fireStatus || FireStatus.active,
        }),
        isAwsCompliant,
        latitude,
        longitude,
        link,
        occurredAt: parseValidDate(properties?.pubDate, dateFormat),
        expiresAt: properties?.end
          ? parseValidDate(properties.end, dateFormat)
          : null,
      };

      return hazard;
    })
    .filter((hazard): hazard is HazardDataWithRelations => hazard !== null);
}

/**
 * Parses World Air Quality Index (WAQI) data to hazards
 *
 * @param data - Array of WAQI station data
 * @param categoryId - The hazard category ID to associate with these hazards
 * @returns Array of HazardDataWithRelations objects
 *
 * @example
 * ```typescript
 * const waqiData = [
 *   {
 *     "lat": -27.5358,
 *     "lon": 152.9934,
 *     "uid": 5116,
 *     "aqi": "64",
 *     "station": {
 *       "name": "Rocklea",
 *       "time": "2025-11-19T18:00:00+09:00"
 *     }
 *   }
 * ];
 * const hazards = parseWAQIToHazards(waqiData, categoryId);
 * ```
 */
export function parseWAQIToHazards({
  data,
  category,
}: {
  data: Array<{
    lat: number;
    lon: number;
    uid: number;
    aqi: string;
    station: {
      name: string;
      time: string;
    };
  }>;
  category: HazardCategory;
}): HazardDataWithRelations[] {
  if (!Array.isArray(data) || !data.length) {
    return [];
  }

  return data
    .map((item) => {
      const aqiValue = parseInt(item.aqi, 10);

      const title = `Air Quality Alert - ${item.station.name}`;

      // Build comprehensive description
      const descriptionParts: string[] = [
        `Station: ${item.station.name}`,
        `AQI: ${aqiValue}`,
        `Coordinates: ${item.lat}, ${item.lon}`,
        `Last Updated: ${item.station.time}`,
      ];

      const description = descriptionParts.join("\n");

      // Determine severity band based on AQI value
      const severityBand = getSeverityBandFromAQI(aqiValue);

      const id = `waqi-${item.uid}`;

      const hazard: HazardDataWithRelations = {
        id,
        title,
        description,
        latitude: item.lat,
        longitude: item.lon,
        category,
        severityBand,
        occurredAt: parseValidDate(item.station.time),
      };

      return hazard;
    })
    .filter((hazard): hazard is HazardDataWithRelations => hazard !== null);
}

/**
 * Converts UV index and pollen data into an array of Hazard objects
 *
 * @param data - Array of UV index and pollen objects from Open-Meteo API
 * @param uvCategory - The hazard category for UV index hazards
 * @param pollenCategory - The hazard category for pollen hazards
 * @returns Array of Prisma HazardCreateInput objects ready for database insertion
 *
 * @example
 * ```typescript
 * const uvPollenData = [
 *   {
 *     latitude: -37.8,
 *     longitude: 145.0,
 *     timezone: "Australia/Melbourne",
 *     current: {
 *       time: "2025-11-19T21:00",
 *       uv_index: 8.5,
 *       birch_pollen: 15.2,
 *       grass_pollen: 45.7,
 *       olive_pollen: null,
 *       ragweed_pollen: 12.3
 *     }
 *   }
 * ];
 * const hazards = parseUVIndexAndPollenToHazards(uvPollenData, uvCategory, pollenCategory);
 * ```
 */
export function parseUVIndexAndPollenToHazards({
  data,
  uvCategory,
  pollenCategory,
}: {
  data: Array<{
    latitude: number;
    longitude: number;
    timezone?: string;
    timezone_abbreviation?: string;
    current: {
      time: string;
      uv_index: number;
      birch_pollen?: number | null;
      grass_pollen?: number | null;
      olive_pollen?: number | null;
      ragweed_pollen?: number | null;
    };
  }>;
  uvCategory: HazardCategory;
  pollenCategory: HazardCategory;
}): HazardDataWithRelations[] {
  if (!Array.isArray(data) || !data.length) {
    return [];
  }

  const hazards: HazardDataWithRelations[] = [];

  data.forEach((item) => {
    const { latitude, longitude, timezone, current } = item;
    const locationId = `${latitude.toFixed(1)}_${longitude.toFixed(1)}`;

    const uvSeverityBand = getSeverityBandFromUVIndex(current.uv_index);
    const uvLevel = getUVLevel(current.uv_index);

    const uvTitle = `UV Index Alert - ${uvLevel}`;
    const uvDescriptionParts: string[] = [
      `UV Index: ${current.uv_index.toFixed(2)}`,
      `Level: ${uvLevel}`,
      `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    ];

    if (timezone) {
      uvDescriptionParts.push(`Timezone: ${timezone}`);
    }

    uvDescriptionParts.push(`Last Updated: ${current.time}`);

    const uvHazard: HazardDataWithRelations = {
      id: `uv-${locationId}`,
      title: uvTitle,
      description: uvDescriptionParts.join("\n"),
      latitude,
      longitude,
      category: uvCategory,
      severityBand: uvSeverityBand,
      occurredAt: parseValidDate(current.time),
    };

    hazards.push(uvHazard);

    // Create pollen hazards for each type with significant levels
    const pollenTypes = [
      { key: "birch_pollen" as const, name: "Birch" },
      { key: "grass_pollen" as const, name: "Grass" },
      { key: "olive_pollen" as const, name: "Olive" },
      { key: "ragweed_pollen" as const, name: "Ragweed" },
    ];

    pollenTypes.forEach((pollenType) => {
      const pollenValue = current[pollenType.key] || 0;

      const pollenSeverityBand = getSeverityBandFromPollenCount(pollenValue);
      const pollenLevel = getPollenLevel(pollenValue);

      const pollenTitle = `${pollenType.name} Pollen Alert - ${pollenLevel}`;
      const pollenDescriptionParts: string[] = [
        `Pollen Type: ${pollenType.name}`,
        `Count: ${pollenValue.toFixed(1)} grains/m³`,
        `Level: ${pollenLevel}`,
        `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      ];

      if (timezone) {
        pollenDescriptionParts.push(`Timezone: ${timezone}`);
      }

      pollenDescriptionParts.push(`Last Updated: ${current.time}`);

      const pollenHazard: HazardDataWithRelations = {
        id: `pollen-${pollenType.key.replace("_pollen", "")}-${locationId}`,
        title: pollenTitle,
        description: pollenDescriptionParts.join("\n"),
        latitude,
        longitude,
        category: pollenCategory,
        severityBand: pollenSeverityBand,
        occurredAt: parseValidDate(current.time),
      };

      hazards.push(pollenHazard);
    });
  });

  return hazards;
}

/**
 * Get UV level description from UV index value
 */
function getUVLevel(uvIndex: number): string {
  if (uvIndex >= 0 && uvIndex <= 2) return "Low";
  if (uvIndex >= 3 && uvIndex <= 5) return "Moderate";
  if (uvIndex >= 6 && uvIndex <= 7) return "High";
  if (uvIndex >= 8 && uvIndex <= 10) return "Very High";
  if (uvIndex >= 11) return "Extreme";
  return "Unknown";
}

/**
 * Get pollen level description from pollen count
 */
function getPollenLevel(pollenCount: number): string {
  if (pollenCount >= 0 && pollenCount <= 30) return "Low";
  if (pollenCount >= 31 && pollenCount <= 60) return "Moderate";
  if (pollenCount >= 61 && pollenCount <= 90) return "High";
  if (pollenCount >= 91) return "Very High";
  return "Unknown";
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
export async function parseRSSFeedToHazards({
  url,
  idPrefix = "rss",
  availableCategories,
}: {
  url: string;
  idPrefix?: string;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): Promise<HazardDataWithRelations[]> {
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
      (item.guid &&
        extractIdFromGUID(item.guid) &&
        `${idPrefix}-${extractIdFromGUID(item.guid)}`) ||
      (item.id && `${idPrefix}-${item.id}`);

    const { severity, severityBand, category, fireStatus, isAwsCompliant } =
      getHazardAttributesFromDescription(description, availableCategories);

    const hazard: HazardDataWithRelations = {
      id,
      title,
      severity,
      severityBand,
      category,
      ...(category.isFireRelated && {
        fireStatus,
      }),
      isAwsCompliant,
      description,
      latitude,
      longitude,
      occurredAt: parseValidDate(item.pubDate),
    };

    return hazard;
  });
}

/**
 * Converts BOM (Bureau of Meteorology) RSS feed into Hazard objects
 *
 * @param url - URL of the BOM RSS feed
 * @param availableCategories - Array of available hazard categories
 * @param idPrefix - Prefix for hazard IDs (default: "bom")
 * @returns Promise resolving to an array of HazardDataWithRelations objects
 *
 * @description
 * Parses BOM RSS feed which contains weather warnings for Australian states.
 * The feed includes various warning types such as:
 * - Marine Wind Warnings
 * - Heatwave Warnings
 * - Severe Thunderstorm Warnings
 * - Severe Weather Warnings
 * - Fire Weather Warnings
 *
 * The title field contains the warning information and is used as both the title and description.
 *
 * @example
 * ```typescript
 * const url = "http://www.bom.gov.au/fwo/IDZ00054.warnings_nsw.xml";
 * const hazards = await parseBOMFeedToHazards({
 *   url,
 *   availableCategories,
 *   idPrefix: "bom-nsw"
 * });
 * ```
 */
export async function parseBOMFeedToHazards({
  url,
  availableCategories,
  australianState,
}: {
  url: string;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
  australianState: AustralianStates;
}): Promise<HazardDataWithRelations[]> {
  const parser = new Parser({
    customFields: {
      item: ["guid"],
    },
  });

  const feed = await parser.parseURL(url);

  if (!feed.items?.length) return [];

  const hazards: HazardDataWithRelations[] = [];

  for (const item of feed.items) {
    // Use title as both title and description as per requirement
    const content = item.title
      ?.replaceAll("\n", " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!content) continue;

    const title = content
      .replace(/\d{1,2}\/\d{1,2}:\d{2}\s+[A-Z]{3,4}$/i, "")
      .trim();
    const description = content;

    // Extract hazard attributes from the title/description
    const { severity, severityBand, category, fireStatus, isAwsCompliant } =
      getHazardAttributesFromDescription(
        description,
        availableCategories,
        MainCategoryId.weatherAndEnvironment
      );

    // For BOM data, we typically don't have coordinates in the RSS feed
    // So we set them to null - these should be geocoded later if needed
    const hazard: HazardDataWithRelations = {
      title,
      severity,
      severityBand,
      category,
      ...(category.isFireRelated && {
        fireStatus,
      }),
      isAwsCompliant,
      description,
      latitude: null,
      longitude: null,
      occurredAt: parseValidDate(item.pubDate),
    };

    hazards.push(hazard);
  }

  return parseBOMFeedToHazardsPhase2(hazards, australianState);
}

/**
 * Phase 2 processing for BOM feed hazards to extract locations from descriptions
 * and create separate hazards for each location found.
 *
 * @param hazards - Array of HazardDataWithRelations objects from Phase 1
 * @returns Promise resolving to an array of HazardDataWithRelations objects with locations processed
 */
const parseBOMFeedToHazardsPhase2 = async (
  hazards: HazardDataWithRelations[],
  australianState: AustralianStates
): Promise<HazardDataWithRelations[]> => {
  const allHazards = await Promise.all(
    hazards.map(async (hazard) => {
      const description = hazard.description;
      console.log("Extracting locations from description:", description);
      const locations = await getLocationsFromText(description);

      // If no locations found, return the original hazard
      if (!locations || locations.length === 0) {
        return [hazard];
      }

      // Create a separate hazard for each location
      return locations.map((locationName) => ({
        id: `${ExternalSourceId.bom}-${locationName
          .replaceAll(" ", "-")
          .toLowerCase()}-${hazard.category?.id}`,
        ...hazard,
        locationName: `${locationName},${
          australianState !== locationName &&
          AustralianStatesShort[australianState] !== locationName
            ? ` ${australianState},`
            : ""
        } Australia`,
      }));
    })
  );

  // Flatten the array of arrays into a single array
  return allHazards.flat();
};

/**
 * Converts WA DFES (Department of Fire and Emergency Services) RSS feed into Hazard objects
 *
 * @param url - URL of the WA DFES RSS feed
 * @param availableCategories - Array of available hazard categories
 * @param idPrefix - Prefix for hazard IDs (default: "waDfes")
 * @returns Promise resolving to an array of HazardDataWithRelations objects
 *
 * @description
 * Parses WA DFES RSS feed which contains emergency warnings, cyclone alerts, and bushfire advice.
 * The feed includes:
 * - Multiple warning types within a single item (Cyclone Emergency Warning, Watch and Act, Advice)
 * - GeoRSS polygon data for affected areas
 * - Rich HTML description with structured sections
 * - Region information
 * - Incident numbers
 *
 * @example
 * ```typescript
 * const url = "https://emergency.wa.gov.au/feed/all-wa.xml";
 * const hazards = await parseWAWarningsToHazards({
 *   url,
 *   availableCategories,
 *   idPrefix: "waDfes"
 * });
 * ```
 */
export async function parseWAWarningsToHazards({
  url,
  availableCategories,
}: {
  url: string;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): Promise<HazardDataWithRelations[]> {
  const parser = new Parser({
    customFields: {
      item: [
        "description",
        "content",
        ["georss:polygon", "georssPolygon"],
        ["georss:alertLevel", "alertLevel"],
        ["geo:lat", "geoLat"],
        ["geo:long", "geoLong"],
        ["dfes:region", "dfesRegion"],
        ["dfes:incidentNumber", "dfesIncidentNumber"],
        ["dfes:publicationTime", "dfesPublicationTime"],
      ],
    },
  });

  const feed = await parser.parseURL(url);

  if (!feed.items?.length) return [];

  const hazards: HazardDataWithRelations[] = [];

  for (const item of feed.items) {
    // Extract multiple warnings from a single item
    // WA DFES items can contain multiple warnings in the description
    const warnings = extractWAWarningsFromDescription(
      item.description || item.content || ""
    );

    // If we found structured warnings, create a hazard for each
    if (warnings.length > 0) {
      for (const warning of warnings) {
        const hazard = createWAHazardFromWarning({
          item,
          warning,
          availableCategories,
        });
        if (hazard) {
          hazards.push(hazard);
        }
      }
    } else {
      // Fall back to creating a single hazard from the entire item
      const hazard = createWAHazardFromItem({
        item,
        availableCategories,
      });
      if (hazard) {
        hazards.push(hazard);
      }
    }
  }

  return hazards;
}

/**
 * Converts WA DFES (Department of Fire and Emergency Services) incident RSS feed into Hazard objects
 *
 * @param url - URL of the WA DFES incidents RSS feed
 * @param availableCategories - Array of available hazard categories
 * @param idPrefix - Prefix for hazard IDs (default: "waIncident")
 * @returns Promise resolving to an array of HazardDataWithRelations objects
 *
 * @description
 * Parses WA DFES incidents RSS feed which contains burn offs, bushfires, and other incidents.
 * The feed includes:
 * - Incident type (Burn Off, Bushfire, etc.)
 * - Region information
 * - Incident/CAD numbers
 * - Geographic coordinates (geo:lat, geo:long)
 * - Publication timestamps
 *
 * @example
 * ```typescript
 * const url = "https://emergency.wa.gov.au/feed/incidents-all.xml";
 * const hazards = await parseWAIncidentsToHazards({
 *   url,
 *   availableCategories,
 *   idPrefix: "waIncident"
 * });
 * ```
 */
export async function parseWAIncidentsToHazards({
  url,
  availableCategories,
}: {
  url: string;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): Promise<HazardDataWithRelations[]> {
  const parser = new Parser({
    customFields: {
      item: [
        "description",
        ["geo:lat", "geoLat"],
        ["geo:long", "geoLong"],
        ["georss:polygon", "georssPolygon"],
      ],
    },
  });

  const feed = await parser.parseURL(url);

  if (!feed.items?.length) return [];

  const hazards: HazardDataWithRelations[] = [];

  for (const item of feed.items) {
    const { title, link, description, geoLat, geoLong, guid, pubDate } = item;

    // Parse coordinates
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (geoLat && geoLong) {
      const lat = parseFloat(geoLat);
      const lon = parseFloat(geoLong);
      if (!isNaN(lat) && !isNaN(lon)) {
        latitude = lat;
        longitude = lon;
      }
    }

    // Skip if no coordinates
    if (!latitude || !longitude) {
      continue;
    }

    // Extract incident information from description
    const incidentInfo = extractWAIncidentInfo(description);

    // Clean the title - extract incident type and location
    // Title format: "Incident Type (LOCATION, SHIRE, REGION, CAD-ID: NUMBER)"
    const cleanedTitle = cleanWAIncidentTitle(title);

    // Build description
    const descriptionParts: string[] = [];

    if (incidentInfo.incidentType) {
      descriptionParts.push(`Incident Type: ${incidentInfo.incidentType}`);
    }

    if (incidentInfo.region) {
      descriptionParts.push(`Region: ${incidentInfo.region}`);
    }

    const fullDescription = descriptionParts.join("\n");

    // Generate ID from GUID or incident number
    const hazardId =
      (guid && `${ExternalSourceId.waDfes}-${guid}`) ||
      (incidentInfo.incidentNumber &&
        `${ExternalSourceId.waDfes}-${incidentInfo.incidentNumber}`);

    // Determine category and severity from incident type and description
    const { category, fireStatus, isAwsCompliant } =
      getHazardAttributesFromDescription(
        incidentInfo.incidentType || fullDescription,
        availableCategories
      );

    const hazard: HazardDataWithRelations = {
      ...(hazardId && { id: hazardId }),
      title: cleanedTitle,
      description: fullDescription,
      severity: HazardSeverity.unknown,
      severityBand: HazardSeverityBand.info,
      category,
      ...(category.isFireRelated && {
        fireStatus: fireStatus || FireStatus.active,
      }),
      link: link || null,
      isAwsCompliant,
      latitude,
      longitude,
      locationName: incidentInfo.region || null,
      occurredAt: parseValidDate(pubDate),
    };

    hazards.push(hazard);
  }

  return hazards;
}

/**
 * Extracts incident information from WA DFES incident description
 * @param description - CDATA description from RSS item
 * @returns Object containing incidentType, region, incidentNumber, and publicationTime
 */
function extractWAIncidentInfo(description?: string): {
  incidentType: string | null;
  region: string | null;
  incidentNumber: string | null;
  publicationTime: string | null;
} {
  if (!description) {
    return {
      incidentType: null,
      region: null,
      incidentNumber: null,
      publicationTime: null,
    };
  }

  // Extract incident type (e.g., "Burn Off", "Bushfire")
  const incidentTypeMatch = description.match(/^([^<]+)/);
  const incidentType = incidentTypeMatch?.[1]?.trim() || null;

  // Extract region from <region> tags
  const regionMatch = description.match(/<region>([^<]+)<\/region>/);
  const region = regionMatch?.[1]?.trim() || null;

  // Extract incident number from <incidentNumber> tags
  const incidentNumberMatch = description.match(
    /<incidentNumber>([^<]+)<\/incidentNumber>/
  );
  const incidentNumber = incidentNumberMatch?.[1]?.trim() || null;

  // Extract publication time from <publicationTime> tags
  const publicationTimeMatch = description.match(
    /<publicationTime>([^<]+)<\/publicationTime>/
  );
  const publicationTime = publicationTimeMatch?.[1]?.trim() || null;

  return {
    incidentType,
    region,
    incidentNumber,
    publicationTime,
  };
}

/**
 * Cleans WA incident title by extracting incident type and location
 * @param title - Raw title from RSS item
 * @returns Cleaned title string
 */
function cleanWAIncidentTitle(title?: string): string {
  if (!title) return "Untitled Incident";

  // Title format: "Incident Type (LOCATION, SHIRE, REGION, CAD-ID: NUMBER)"
  // Extract incident type and location
  const match = title.match(/^([^(]+)\s*\(([^,]+)/);

  if (match?.[1] && match?.[2]) {
    const incidentType = match[1].trim();
    const location = match[2].trim();
    return `${incidentType} - ${location}`;
  }

  return title.trim();
}

/**
 * Extracts structured warning information from WA DFES HTML description
 * @param description - HTML description from RSS item
 * @returns Array of warning objects with id, type, and details
 */
function extractWAWarningsFromDescription(description: string): Array<{
  id: string;
  warningType: string;
  title: string;
  content: string;
}> {
  const warnings: Array<{
    id: string;
    warningType: string;
    title: string;
    content: string;
  }> = [];

  if (!description) {
    return warnings;
  }

  // Look for warning sections in the HTML
  // The pattern needs to match: <p id="ID" data-hazard-type="Warnings" data-warning-type="TYPE"><strong>TITLE</strong></p>
  // Note: Attributes can be in any order, and there may be spaces around values
  const warningPattern =
    /<p[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*\bdata-warning-type\s*=\s*["']([^"']+)["'][^>]*>\s*<strong[^>]*>\s*(.*?)\s*<\/strong>\s*<\/p>/gi;

  // Alternative: Try to match even if attributes are in different order
  const altPattern =
    /<p[^>]*\bdata-warning-type\s*=\s*["']([^"']+)["'][^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>\s*<strong[^>]*>\s*(.*?)\s*<\/strong>\s*<\/p>/gi;

  let match;
  let foundCount = 0;

  // Try first pattern
  while ((match = warningPattern.exec(description)) !== null) {
    foundCount++;
    const id = match[1];
    const warningType = match[2];
    const title = match[3]?.replace(/<[^>]+>/g, "").trim() || "";

    if (id && warningType && title) {
      // Extract content after this warning tag until the next warning or major section break
      // Major sections include: CYCLONE DETAILS, ROAD CLOSURES, WHAT EMERGENCY SERVICES ARE DOING, KEEP UP TO DATE, END
      const startPos = match.index + match[0].length;
      const remainingContent = description.substring(startPos);

      // Look for next warning (has id attribute) or major section heading
      // Major sections are identified by specific all-caps titles
      const nextSectionMatch = remainingContent.match(
        /<p[^>]*\bid\s*=\s*["']|<p\s+class\s*=\s*["']subtitle["'][^>]*>\s*(CYCLONE DETAILS|BUSHFIRE BEHAVIOUR|ROAD CLOSURES|WHAT FIREFIGHTERS ARE DOING|WHAT EMERGENCY SERVICES ARE DOING|ANIMAL WELFARE|EXTRA INFORMATION|KEEP UP TO DATE|END)\s*<\/p>/i
      );

      const endPos = nextSectionMatch
        ? startPos + nextSectionMatch.index!
        : description.length;
      const content = description.substring(startPos, endPos).trim();

      warnings.push({
        id,
        warningType,
        title,
        content: cleanDescription(content),
      });
    }
  }

  // If first pattern didn't work, try alternative pattern
  if (foundCount === 0) {
    while ((match = altPattern.exec(description)) !== null) {
      foundCount++;
      const warningType = match[1];
      const id = match[2];
      const title = match[3]?.replace(/<[^>]+>/g, "").trim() || "";

      if (id && warningType && title) {
        const startPos = match.index + match[0].length;
        const remainingContent = description.substring(startPos);

        // Look for next warning or major section heading
        const nextSectionMatch = remainingContent.match(
          /<p[^>]*\bid\s*=\s*["']|<p\s+class\s*=\s*["']subtitle["'][^>]*>\s*(CYCLONE DETAILS|BUSHFIRE BEHAVIOUR|ROAD CLOSURES|WHAT FIREFIGHTERS ARE DOING|WHAT EMERGENCY SERVICES ARE DOING|ANIMAL WELFARE|EXTRA INFORMATION|KEEP UP TO DATE|END)\s*<\/p>/i
        );

        const endPos = nextSectionMatch
          ? startPos + nextSectionMatch.index!
          : description.length;
        const content = description.substring(startPos, endPos).trim();

        warnings.push({
          id,
          warningType,
          title,
          content: cleanDescription(content),
        });
      }
    }
  }

  console.log(`Total warnings found: ${warnings.length}`);

  return warnings;
}

/**
 * Creates a hazard from a WA DFES warning extracted from the description
 */
function createWAHazardFromWarning({
  item,
  warning,
  availableCategories,
}: {
  item: any;
  warning: { id: string; warningType: string; title: string; content: string };
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): HazardDataWithRelations | null {
  const { geoLat, geoLong, dfesRegion, dfesIncidentNumber, guid } = item;

  // Parse coordinates
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (geoLat && geoLong) {
    const lat = parseFloat(geoLat);
    const lon = parseFloat(geoLong);
    if (!isNaN(lat) && !isNaN(lon)) {
      latitude = lat;
      longitude = lon;
    }
  }

  // If no coordinates, skip this warning
  if (!latitude || !longitude) {
    return null;
  }

  // Build full description including warning-specific content and region info
  const descriptionParts: string[] = [];
  descriptionParts.push(`Warning Type: ${warning.warningType}`);
  if (dfesRegion) {
    descriptionParts.push(`Region: ${dfesRegion}`);
  }

  if (warning.content) {
    descriptionParts.push(warning.content);
  }

  const description = descriptionParts.join("\n");

  // Generate ID from warning ID
  const hazardId = `${ExternalSourceId.waDfes}-${
    warning.id || dfesIncidentNumber
  }`;

  // Generate link to DFES incident if incident number is available
  const link =
    warning.id && `https://emergency.wa.gov.au/warnings/${warning.id}`;

  const { severity, severityBand, category, isAwsCompliant } =
    getHazardAttributesFromDescription(
      warning.warningType,
      availableCategories
    );
  const { fireStatus } = getHazardAttributesFromDescription(
    description,
    availableCategories
  );

  return {
    id: hazardId,
    title: warning.title,
    description,
    severity,
    severityBand,
    category,
    ...(category.isFireRelated && {
      fireStatus,
    }),
    link,
    isAwsCompliant,
    latitude,
    longitude,
    locationName: dfesRegion || undefined,
    occurredAt: parseValidDate(item.pubDate),
  };
}

/**
 * Creates a hazard from a WA DFES RSS item (fallback when no structured warnings found)
 */
function createWAHazardFromItem({
  item,
  availableCategories,
}: {
  item: any;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): HazardDataWithRelations | null {
  const {
    title,
    link,
    description,
    content,
    geoLat,
    geoLong,
    dfesRegion,
    dfesIncidentNumber,
    guid,
    pubDate,
  } = item;

  // Parse coordinates
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (geoLat && geoLong) {
    const lat = parseFloat(geoLat);
    const lon = parseFloat(geoLong);
    if (!isNaN(lat) && !isNaN(lon)) {
      latitude = lat;
      longitude = lon;
    }
  }

  // If no coordinates, skip this item
  if (!latitude || !longitude) {
    return null;
  }

  const cleanedTitle = cleanRSSTitle(title || "Untitled Incident");
  let cleanedDescription = cleanDescription(content || description || "");

  // Add region info if available
  if (dfesRegion) {
    cleanedDescription = `Region: ${dfesRegion}\n${cleanedDescription}`;
  }

  // Generate ID
  const hazardId =
    (dfesIncidentNumber &&
      `${ExternalSourceId.waDfes}-${dfesIncidentNumber}`) ||
    (guid && `${ExternalSourceId.waDfes}-${guid}`) ||
    undefined;

  const { severity, severityBand, category, fireStatus, isAwsCompliant } =
    getHazardAttributesFromDescription(cleanedDescription, availableCategories);

  return {
    id: hazardId,
    title: cleanedTitle,
    description: cleanedDescription,
    severity,
    severityBand,
    category,
    ...(category.isFireRelated && {
      fireStatus,
    }),
    link,
    isAwsCompliant,
    latitude,
    longitude,
    locationName: dfesRegion || undefined,
    occurredAt: parseValidDate(pubDate),
  };
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
export function parseCFSFeedToHazards({
  data,
  availableCategories,
}: {
  data: any[];
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): HazardDataWithRelations[] {
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

    const { severity, severityBand, category, fireStatus, isAwsCompliant } =
      getHazardAttributesFromDescription(description, availableCategories);

    const hazard: HazardDataWithRelations = {
      id: hazardId,
      title,
      description,
      severity,
      severityBand,
      category,
      ...(category.isFireRelated && {
        fireStatus,
      }),
      isAwsCompliant,
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
export function parseNTFireAndRescueToHazards({
  data,
  availableCategories,
}: {
  data: any;
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[];
}): HazardDataWithRelations[] {
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

      const { severity, severityBand, category, fireStatus, isAwsCompliant } =
        getHazardAttributesFromDescription(description, availableCategories);

      const hazard: HazardDataWithRelations = {
        ...(hazardId && { id: hazardId }),
        title,
        description,
        severity,
        severityBand,
        category,
        ...(category.isFireRelated && {
          fireStatus,
        }),
        isAwsCompliant,
        locationName:
          properties?._location || properties?.Location || undefined,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        occurredAt,
        expiresAt,
      };

      return hazard;
    })
    .filter(
      (
        hazard: HazardDataWithRelations | null
      ): hazard is HazardDataWithRelations => hazard !== null
    );
}

/**
 * Converts Smart Traveller travel advice data into an array of Hazard objects
 *
 * @param data - Array of travel advisories from Smart Traveller API
 * @param availableCategories - The list of available hazard categories to match against
 * @returns Array of HazardDataWithRelations objects ready for database insertion
 *
 * @example
 * ```typescript
 * const smartTravellerData = [
 *   {
 *     "title": "Afghanistan",
 *     "field_overall_advice_level": "Do not travel",
 *     "field_last_update": "Do not travel to Afghanistan...",
 *     "field_last_update_notes": "We continue to advise...",
 *     "field_region": "Asia",
 *     "field_advice_levels": "Do not travel to Afghanistan...",
 *     "field_url": "https://www.smartraveller.gov.au/destinations/asia/afghanistan",
 *     "changed": "Fri, 2025-11-14 14:22"
 *   }
 * ];
 * const hazards = parseSmartravellerToHazards(smartTravellerData, availableCategories);
 * ```
 */
export function parseSmartravellerToHazards({
  data,
  category,
}: {
  data: Array<{
    title: string;
    field_overall_advice_level: string;
    field_last_update: string;
    field_last_update_notes?: string;
    field_region?: string;
    field_advice_levels?: string;
    field_url?: string;
    field_seo_title?: string;
    field_seo_description?: string;
    changed?: string;
  }>;
  category: HazardCategory;
}): HazardDataWithRelations[] {
  if (!Array.isArray(data) || !data.length) return [];

  const hazards: HazardDataWithRelations[] = [];

  for (const advisory of data) {
    const country = advisory.title;
    const adviceLevel = advisory.field_overall_advice_level;

    // Skip if no advice level (shouldn't happen, but just in case)
    if (!adviceLevel) continue;

    // Build comprehensive description
    const descriptionParts: string[] = [];

    descriptionParts.push(`Country: ${country}`);
    descriptionParts.push(`Travel Advice Level: ${adviceLevel}`);

    // Add the main advisory text
    if (advisory.field_last_update) {
      descriptionParts.push(`\n${advisory.field_last_update}`);
    }

    const description = descriptionParts
      .join("\n")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\*\*/g, "")
      .replace(/ +/g, " ")
      .trim();

    // Create a standardized title
    const hazardTitle =
      advisory.field_seo_title ||
      `${country} - Travel Advisory: ${adviceLevel}`;

    // Determine severity band from advice level
    const severityBand = getSeverityBandFromSmartravellerLevel(adviceLevel);

    const callsToAction = advisory.field_last_update_notes
      ? advisory.field_last_update_notes
          .replace(/&nbsp;/g, " ")
          .replace(/&[a-z]+;/gi, " ")
          .split("\n")
          .slice(1)
          .filter((line) => line.trim())
          .map((line) => line.trim())
      : undefined;

    // Parse the last updated date
    const occurredAt = advisory.changed
      ? parseValidDate(advisory.changed)
      : undefined;

    // Create hazard with location name
    const hazard: HazardDataWithRelations = {
      id: `${ExternalSourceId.smartraveller}-${country
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      title: hazardTitle,
      description,
      severityBand,
      category,
      ...(callsToAction && callsToAction.length > 0 && { callsToAction }),
      isAwsCompliant: false, // Travel advisories are not AWS compliant
      locationName: country,
      ...(advisory.field_url && { link: advisory.field_url }),
      ...(occurredAt && { occurredAt }),
    };

    hazards.push(hazard);
  }

  return hazards;
}

/**
 * Converts USGS Earthquake GeoJSON data to an array of Hazard objects
 *
 * @param data - GeoJSON FeatureCollection containing earthquake data
 * @param category - The hazard category to associate with these earthquake hazards
 * @returns Array of HazardDataWithRelations objects ready for database insertion
 *
 * @example
 * ```typescript
 * const earthquakeData = {
 *   "type": "FeatureCollection",
 *   "features": [
 *     {
 *       "type": "Feature",
 *       "properties": {
 *         "mag": 2.24,
 *         "place": "5 km NE of Petaluma, CA",
 *         "time": 1767509792290,
 *         "updated": 1767510441921,
 *         "url": "https://earthquake.usgs.gov/earthquakes/eventpage/nc75290641",
 *         "status": "automatic",
 *         "tsunami": 0,
 *         "type": "earthquake",
 *         "title": "M 2.2 - 5 km NE of Petaluma, CA"
 *       },
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [-122.589332580566, 38.2621650695801, 5.07000017166138]
 *       },
 *       "id": "nc75290641"
 *     }
 *   ]
 * };
 * const hazards = parseUSGSEarthquakeToHazards({ data: earthquakeData, category });
 * ```
 */
export function parseUSGSEarthquakeToHazards({
  data,
  earthquakeCategory,
}: {
  data: FeatureCollection<Point, GeoJsonProperties>;
  earthquakeCategory: HazardCategory;
}): HazardDataWithRelations[] {
  if (!data.features?.length) return [];

  return data.features
    .map((feature) => {
      const { id, properties, geometry } = feature;

      // Extract coordinates (longitude, latitude, depth)
      const coordinates = geometry.coordinates;
      const longitude = coordinates[0];
      const latitude = coordinates[1];
      const depth = coordinates[2]; // Depth in kilometers

      // Skip if no valid coordinates
      if (longitude == null || latitude == null) {
        return null;
      }

      // Extract earthquake properties
      const magnitude = properties?.mag;
      const place = properties?.place || "Unknown location";
      const time = properties?.time; // Unix timestamp in milliseconds
      const updated = properties?.updated;
      const url = properties?.url;
      const tsunami = properties?.tsunami;
      const status = properties?.status; // "automatic", "reviewed", etc.
      const magType = properties?.magType; // "ml", "md", "mw", etc.
      const alert = properties?.alert; // "green", "yellow", "orange", "red"
      const sig = properties?.sig; // Significance score
      const title = properties?.title || `M ${magnitude} - ${place}`;

      // Build comprehensive description
      const descriptionParts: string[] = [];

      descriptionParts.push(`Location: ${place}`);

      if (magnitude != null) {
        descriptionParts.push(
          `Magnitude: ${magnitude}${magType ? ` (${magType})` : ""}`
        );
      }

      if (depth != null) {
        descriptionParts.push(`Depth: ${depth.toFixed(2)} km`);
      }

      if (status) {
        descriptionParts.push(
          `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`
        );
      }

      if (tsunami === 1) {
        descriptionParts.push(`Tsunami Warning: Yes`);
      }

      if (sig != null) {
        descriptionParts.push(`Significance: ${sig}`);
      }

      const description = descriptionParts.join("\n");

      // Determine severity band based on magnitude and alert level
      let severityBand: HazardSeverityBand;

      if (alert === "red" || magnitude >= 7.0 || tsunami === 1) {
        severityBand = HazardSeverityBand.critical;
      } else if (alert === "orange" || magnitude >= 6.0) {
        severityBand = HazardSeverityBand.action;
      } else if (alert === "yellow" || magnitude >= 3.0) {
        severityBand = HazardSeverityBand.monitor;
      } else {
        severityBand = HazardSeverityBand.info;
      }

      // Parse occurrence date from timestamp
      const occurredAt = time ? new Date(time) : new Date();

      // Create hazard ID using the external ID
      const hazardId = id
        ? `${ExternalSourceId.earthquakeUsgs}-${id}`
        : undefined;

      const hazard: HazardDataWithRelations = {
        ...(hazardId && { id: hazardId }),
        title,
        description,
        severityBand,
        category: earthquakeCategory,
        latitude,
        longitude,
        ...(url && { link: url }),
        occurredAt,
        isAwsCompliant: false, // Earthquakes are not AWS compliant
      };

      return hazard;
    })
    .filter((hazard): hazard is HazardDataWithRelations => hazard !== null);
}

// ------------------------------------------------------------------------------------------------------------------------------------- HELPERS

/**
 * GEOCODING OPTIMIZATION UTILITIES:
 *
 * In-memory cache and rate limiting for Google Maps API calls
 * to reduce API usage from >5000 calls/month to <500 calls/month
 */

// In-memory cache for geocoding results to reduce API calls
const geocodingCache = new Map<
  string,
  {
    lat: number;
    lng: number;
    address: string;
    timestamp: number;
    northeastLat?: number | null;
    northeastLng?: number | null;
    southwestLat?: number | null;
    southwestLng?: number | null;
  }
>();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cache for location extraction results
const locationExtractionCache = new Map<
  string,
  { locations: string[]; timestamp: number }
>();
const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
 * Cleans up expired entries from the location extraction cache.
 */
export const cleanupLocationExtractionCache = (): void => {
  const now = Date.now();
  for (const [key, value] of locationExtractionCache.entries()) {
    if (now - value.timestamp > LOCATION_CACHE_TTL) {
      locationExtractionCache.delete(key);
    }
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
 * Gets the current size of the location extraction cache.
 */
export const getLocationExtractionCacheSize = (): number => {
  return locationExtractionCache.size;
};

/**
 * Gets cached location extraction result or returns undefined if not found.
 */
export const getCachedLocationExtraction = (
  cacheKey: string
): { locations: string[]; timestamp: number } | undefined => {
  return locationExtractionCache.get(cacheKey);
};

/**
 * Stores location extraction result in cache.
 */
export const setCachedLocationExtraction = (
  cacheKey: string,
  locations: string[]
): void => {
  locationExtractionCache.set(cacheKey, {
    locations,
    timestamp: Date.now(),
  });
};

/**
 * Populates a single hazard with missing geocoding information using cache when possible.
 * If latitude/longitude is missing, it uses the locationName to fetch coordinates.
 * If locationName is missing, it uses latitude/longitude to fetch the address.
 */
export const populateHazardWithGeocoding = async (
  hazard: HazardDataWithRelations
): Promise<HazardDataWithRelations> => {
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
          if (
            cached.northeastLat !== undefined &&
            cached.northeastLat !== null
          ) {
            hazard.northeastLat = cached.northeastLat;
            hazard.northeastLng = cached.northeastLng ?? null;
            hazard.southwestLat = cached.southwestLat ?? null;
            hazard.southwestLng = cached.southwestLng ?? null;
          }
        } else {
          const result: GeocodeResult | undefined = await rateLimitedGeocode(
            () => convertAddressToLatLng(hazard.locationName!)
          );

          if (result && result.geometry && result.geometry.location) {
            hazard.latitude = result.geometry.location.lat;
            hazard.longitude = result.geometry.location.lng;

            // Add bounds if available
            if (result.geometry.bounds) {
              hazard.northeastLat = result.geometry.bounds.northeast.lat;
              hazard.northeastLng = result.geometry.bounds.northeast.lng;
              hazard.southwestLat = result.geometry.bounds.southwest.lat;
              hazard.southwestLng = result.geometry.bounds.southwest.lng;
            } else if (result.geometry.viewport) {
              // Fallback to viewport if bounds not available
              hazard.northeastLat = result.geometry.viewport.northeast.lat;
              hazard.northeastLng = result.geometry.viewport.northeast.lng;
              hazard.southwestLat = result.geometry.viewport.southwest.lat;
              hazard.southwestLng = result.geometry.viewport.southwest.lng;
            }

            // Cache the result including bounds
            geocodingCache.set(cacheKey, {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
              address: hazard.locationName,
              timestamp: Date.now(),
              ...(hazard.northeastLat !== undefined && {
                northeastLat: hazard.northeastLat,
                northeastLng: hazard.northeastLng,
                southwestLat: hazard.southwestLat,
                southwestLng: hazard.southwestLng,
              }),
            });
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

  return (
    html
      // Convert list items to proper line breaks with bullets
      .replace(/<li[^>]*>\s*<p>/gi, "\n• ")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/li>/gi, "")

      // Convert paragraph and div closings to line breaks
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")

      // Convert <br> tags to line breaks
      .replace(/<br\s*\/?>/gi, "\n")

      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, "")

      // Clean up whitespace
      .replace(/\n\s*\n+/g, "\n") // Replace multiple newlines with single newline
      .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
      .replace(/\n /g, "\n") // Remove spaces at start of lines
      .trim()
  );
}

/**
 * Extracts ID from GUID URLs or returns null if no pattern matches
 *
 * @param guid - The GUID string which may contain URLs with IDs
 * @returns Extracted ID from URL or null if no pattern matches
 *
 * @example
 * extractIdFromGUID("http://emergency.vic.gov.au/respond/#!/incident/242688/moreinfo") // returns "242688"
 * extractIdFromGUID("https://data.eso.sa.gov.au/prod/cfs/criimson/1668103") // returns "1668103"
 * extractIdFromGUID("https://incidents.rfs.nsw.gov.au/api/v1/incidents/630789") // returns "630789"
 * extractIdFromGUID("some-plain-guid") // returns null
 */
function extractIdFromGUID(guid: string): string | null {
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

  // Pattern 3: https://incidents.rfs.nsw.gov.au/api/v1/incidents/630789
  const rfsNswMatch = cleaned.match(/\/incidents\/(\d+)/);
  if (rfsNswMatch && rfsNswMatch[1]) {
    return rfsNswMatch[1];
  }

  // General pattern: extract last numeric segment from URL path
  const urlMatch = cleaned.match(/https?:\/\/[^\/]+\/.*\/(\d+)(?:\/|$)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // If no URL pattern matches, return cleaned GUID as is
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
 * @param dateInput - The date input to parse (string, number, or Date)
 * @param format - Optional format hint: 'DD/MM/YYYY' or 'MM/DD/YYYY'. If not specified, uses smart detection.
 */
function parseValidDate(
  dateInput?: string | number | Date,
  format?: "DD/MM/YYYY" | "MM/DD/YYYY"
): Date {
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
  // First check if it matches a date pattern that could be ambiguous (M/D/YYYY or D/M/YYYY)
  const datePatternMatch = dateInput.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/
  );

  let parsedDate: Date;

  if (datePatternMatch) {
    const [, first, second, year, timepart] = datePatternMatch;
    const firstNum = parseInt(first || "0", 10);
    const secondNum = parseInt(second || "0", 10);

    let reformattedDate: string;

    if (format === "DD/MM/YYYY") {
      // Explicitly treat as DD/MM/YYYY format
      reformattedDate = `${second}/${first}/${year}${timepart || ""}`;
    } else if (format === "MM/DD/YYYY") {
      // Explicitly treat as MM/DD/YYYY format
      reformattedDate = `${first}/${second}/${year}${timepart || ""}`;
    } else {
      // No format specified, use smart detection
      if (firstNum > 12) {
        // First number > 12, so it must be day (DD/MM/YYYY format)
        reformattedDate = `${second}/${first}/${year}${timepart || ""}`;
      } else if (secondNum > 12) {
        // Second number > 12, so it must be day (MM/DD/YYYY format - already correct)
        reformattedDate = `${first}/${second}/${year}${timepart || ""}`;
      } else {
        // Both numbers <= 12, ambiguous case - default to MM/DD/YYYY (JavaScript default)
        reformattedDate = `${first}/${second}/${year}${timepart || ""}`;
      }
    }

    parsedDate = new Date(reformattedDate);
  } else {
    // Not a simple date pattern, try standard JavaScript Date parsing
    parsedDate = new Date(dateInput);
  }

  // Check if the date is valid
  if (isNaN(parsedDate.getTime())) {
    return new Date(); // Return current date if invalid
  }

  return parsedDate;
}

/**
 * Extracts a detailed description from NSW RFS traffic incident properties
 */
function extractNSWTrafficDescription(properties: GeoJsonProperties): string {
  const {
    displayName,
    incidentKind,
    mainCategory,
    subCategoryA,
    adviceA,
    adviceB,
    adviceC,
    otherAdvice,
  } = properties!;
  const descriptionParts: string[] = [];

  if (displayName) descriptionParts.push(`${displayName}`);
  if (incidentKind) descriptionParts.push(`Incident Kind: ${incidentKind}`);
  if (mainCategory) descriptionParts.push(`Main Category: ${mainCategory}`);
  if (subCategoryA && subCategoryA !== "null")
    descriptionParts.push(`Sub Category: ${subCategoryA}`);
  if (adviceA?.trim() || adviceB?.trim() || adviceC?.trim())
    descriptionParts.push(
      `Advice: ${[adviceA, adviceB, adviceC]
        .filter((advice) => advice?.trim())
        .join("; ")}`
    );
  if (otherAdvice?.trim())
    descriptionParts.push(
      `Other Advice: ${cleanDescription(otherAdvice?.trim())}`
    );

  return descriptionParts.join("\n");
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

  return parseValidDate(dateTimeString, "DD/MM/YYYY");
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
    parts.push(`To the Public: ${properties["Advice to the Public"]}`);
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

/**
 * Converts HazardDataWithRelations to Prisma HazardCreateInput
 * by connecting related category and source entities
 */
export const convertHazardDataWithRelationsToCreateInput = (
  hazardData: HazardDataWithRelations
): Prisma.HazardCreateInput => {
  return {
    ...hazardData,
    category: {
      connect: { id: hazardData.category?.id || "other" },
    },
    source: {
      connect: { id: hazardData.source?.id || "other" },
    },
  };
};

/**
 * Extracts hazard attributes from description text
 * @param description The hazard description text
 * @param availableCategories The list of available hazard categories to match against
 * @returns Object containing severity, severityBand, category, fireStatus, and isAwsCompliant
 */
export const getHazardAttributesFromDescription = (
  description: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[],
  fallbackCategoryId?: string
): {
  severity: HazardSeverity;
  severityBand: HazardSeverityBand;
  category: HazardCategory;
  fireStatus: FireStatus | null;
  isAwsCompliant: boolean;
} => {
  const severity = getSeverityFromDescription(description);
  const category = getCategoryFromDescription(
    description,
    availableCategories,
    fallbackCategoryId
  );
  const fireStatus = getFireStatusFromDescription(description);
  const isAwsCompliant =
    awsCompliantSeverities.includes(severity) &&
    awsCompliantCategoryIds.includes(category.id);

  let severityBand: HazardSeverityBand = HazardSeverityBand.info;
  if (isAwsCompliant) {
    // AWS compliant - derive severity band from severity
    severityBand = getSeverityBandFromAWSCompliantSeverity(severity);
  } else {
    // Non AWS compliant - derive severity band from description
    severityBand = getSeverityBandFromDescription(description);
  }

  return {
    severity,
    severityBand,
    category,
    fireStatus,
    isAwsCompliant,
  };
};
