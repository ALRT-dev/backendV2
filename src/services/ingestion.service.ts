import {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
  type Hazard,
  type HazardCategory,
} from "@prisma/client";
import {
  parseBoMWarningsToHazards,
  parseCFSFeedToHazards,
  parseGeoJsonToHazards,
  parseNTFireAndRescueToHazards,
  parseRSSFeedToHazards,
  populateHazardWithGeocoding,
  cleanupGeocodingCache,
  convertHazardDataWithRelationsToCreateInput,
  parseWAQIToHazards,
  parseUVIndexAndPollenToHazards,
  getGeocodingCacheSize,
} from "../utils/ingestion.util.js";
import * as crypto from "crypto";
import prisma from "../utils/prisma_client.util.js";
import {
  summarizeHazard,
  processBatchWithRateLimit,
} from "./hazard.service.js";
import { sendPushNotificationAboutNewHazard } from "./notification.service.js";
import { sendSocketEventAboutHazardToSubscribers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";
import {
  buildHazardInclude,
  getHazardExpiryDateFromSeverity,
} from "../utils/hazard.util.js";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "./confidence_score.service.js";
import { config } from "../utils/config.js";
import { getAllSubHazardCategories } from "./hazard_category.service.js";
import { SyncHazardsFromExternalSourceOption } from "../enums/sync_hazards_from_external_source_option_types.js";
import type { HazardDataWithRelations } from "../models/hazard_data_with_relations_interface.js";

export enum ExternalSourceId {
  rfs = "rfs",
  bom = "bom",
  nswTransport = "nsw-transport",
  actEs = "act-es",
  cfs = "cfs",
  viceFire = "vice-fire",
  qldFire = "qld-fire",
  ntFireAndRescue = "nt-fire-and-rescue",
  waqi = "waqi",
  openMeteo = "open-meteo",
}

// Configuration for hazard sources
interface ExternalSource {
  id: ExternalSourceId;
  name: string;
  url: string;

  apiUrl?: string | undefined;
  apiUrls?: string[] | undefined;
  fetchOptions?: RequestInit | undefined;

  preCheck?:
    | (() => Promise<
        boolean | { skip: true; message?: string | undefined } | undefined
      >)
    | undefined;

  parseFunction: (
    responseData?: any
  ) => HazardDataWithRelations[] | Promise<HazardDataWithRelations[]>;
}

/**
 * Syncs hazards from different sources to the database.
 *
 * Fetches data from all configured sources, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromDifferentSources = async ({
  sourceIds,
  syncOption = SyncHazardsFromExternalSourceOption.ignoreExisting,
}: {
  sourceIds?: string[] | undefined;
  syncOption?: SyncHazardsFromExternalSourceOption;
}): Promise<Hazard[]> => {
  try {
    // Clean up expired cache entries
    cleanupGeocodingCache();

    const availableCategories = await getAllSubHazardCategories();

    const australiaBounds = "-44.0,112.0,-10.0,154.0";
    const australiaLocations = [
      { name: "Sydney", lat: -33.8688, lon: 151.2093 },
      { name: "Melbourne", lat: -37.8136, lon: 144.9631 },
      { name: "Brisbane", lat: -27.4698, lon: 153.0251 },
      { name: "Perth", lat: -31.9505, lon: 115.8605 },
      { name: "Adelaide", lat: -34.9285, lon: 138.6007 },
      { name: "Canberra", lat: -35.2809, lon: 149.13 },
      { name: "Hobart", lat: -42.8821, lon: 147.3272 },
      { name: "Darwin", lat: -12.4634, lon: 130.8456 },
      { name: "Gold Coast", lat: -28.0167, lon: 153.4 },
      { name: "Newcastle", lat: -32.9283, lon: 151.7817 },
    ];

    const externalSources: ExternalSource[] = [
      {
        id: ExternalSourceId.rfs,
        name: "NSW Rural Fire Service",
        url: "https://www.rfs.nsw.gov.au",
        apiUrl: "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json",
        parseFunction: (responseData: any) =>
          parseGeoJsonToHazards({
            data: responseData,
            availableCategories,
            idPrefix: ExternalSourceId.rfs,
            dateFormat: "DD/MM/YYYY",
          }),
      },
      {
        id: ExternalSourceId.bom,
        name: "BoM",
        url: "https://www.bom.gov.au",
        apiUrl:
          "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records?limit=20",
        parseFunction: (responseData: any) =>
          parseBoMWarningsToHazards({
            data: responseData,
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.nswTransport,
        name: "NSW Transport",
        url: "https://www.transport.nsw.gov.au",
        apiUrls: [
          "https://api.transport.nsw.gov.au/v1/live/hazards/incident/open",
          "https://api.transport.nsw.gov.au/v1/live/hazards/majorevent/open",
        ],
        fetchOptions: {
          headers: {
            Authorization: `apikey ${config.nswTransportApi.apiKey}`,
          },
        },
        parseFunction: (responseData: any) =>
          parseGeoJsonToHazards({
            data: responseData,
            availableCategories,
            idPrefix: ExternalSourceId.nswTransport,
          }),
      },
      {
        id: ExternalSourceId.actEs,
        name: "ACT Emergency Services",
        url: "https://www.act.gov.au",
        apiUrl: "https://esa.act.gov.au/feeds/currentincidents.xml",
        parseFunction: () =>
          parseRSSFeedToHazards({
            url: "https://esa.act.gov.au/feeds/currentincidents.xml",
            idPrefix: ExternalSourceId.actEs,
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.cfs,
        name: "CFS",
        url: "https://www.cfs.sa.gov.au",
        apiUrl:
          "https://data.eso.sa.gov.au/prod/cfs/criimson/cfs_current_incidents.json",
        parseFunction: (responseData: any) =>
          parseCFSFeedToHazards({
            data: responseData,
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.viceFire,
        name: "Vice Fire Services",
        url: "https://www.vicefire.com",
        apiUrl: "https://data.emergency.vic.gov.au/Show?pageId=getIncidentRSS",
        parseFunction: () =>
          parseRSSFeedToHazards({
            url: "https://data.emergency.vic.gov.au/Show?pageId=getIncidentRSS",
            idPrefix: ExternalSourceId.viceFire,
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.qldFire,
        name: "QLD Fire Department",
        url: "https://www.qld.gov.au",
        apiUrl:
          "https://publiccontent.gis.psba.qld.gov.au/content/Feeds/BushfireCurrentIncidents/bushfireAlert.xml",
        parseFunction: () =>
          parseRSSFeedToHazards({
            url: "https://publiccontent.gis.psba.qld.gov.au/content/Feeds/BushfireCurrentIncidents/bushfireAlert.xml",
            idPrefix: ExternalSourceId.qldFire,
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.ntFireAndRescue,
        name: "NT Fire and Rescue",
        url: "https://www.nt.gov.au",
        apiUrl: "https://www.pfes.nt.gov.au/incidentmap/json/incidents.json",
        parseFunction: (responseData: any) =>
          parseNTFireAndRescueToHazards({
            data: responseData,
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.waqi,
        name: "World Air Quality",
        url: "https://www.waqi.info",
        apiUrl: `https://api.waqi.info/map/bounds/?latlng=${australiaBounds}&token=${config.waqiApi.apiToken}`,
        parseFunction: (responseData: any) => {
          if (!responseData.data || responseData.data.length === 0) {
            console.log("No WAQI data found for Australia.");
            return [];
          }

          const poorAirQualityCategory = availableCategories.find(
            (cat) => cat.id === "poorAirQuality"
          );
          if (!poorAirQualityCategory) {
            console.log(
              "Poor Air Quality category not found, skipping WAQI hazards."
            );
            return [];
          }

          return parseWAQIToHazards({
            data: responseData.data,
            category: poorAirQualityCategory,
          });
        },
      },
      {
        id: ExternalSourceId.openMeteo,
        name: "Open-Meteo",
        url: "https://open-meteo.com",
        apiUrls: australiaLocations.map((location) => {
          const apiUrl =
            "https://air-quality-api.open-meteo.com/v1/air-quality";
          const params = new URLSearchParams({
            latitude: location.lat.toString(),
            longitude: location.lon.toString(),
            current:
              "uv_index,birch_pollen,grass_pollen,olive_pollen,ragweed_pollen",
            timezone: "auto",
          });
          return `${apiUrl}?${params.toString()}`;
        }),
        parseFunction: (responseData: any) => {
          const pollenCategory = availableCategories.find(
            (cat: HazardCategory) => cat.id === "pollen"
          );
          const uvCategory = availableCategories.find(
            (cat: HazardCategory) => cat.id === "uvIndex"
          );
          if (!pollenCategory || !uvCategory) {
            console.log(
              "Pollen or UV Index category not found, skipping Open-Meteo hazards."
            );
            return [];
          }

          return parseUVIndexAndPollenToHazards({
            data: responseData,
            uvCategory,
            pollenCategory,
          });
        },
      },
    ].filter((sourceConfig) =>
      sourceIds && sourceIds.length > 0
        ? sourceIds.includes(sourceConfig.id)
        : true
    );

    // Step 1: Fetch all hazards from all sources simultaneously
    console.log(
      `---------------------------------------> Fetching hazards from ${externalSources.length} sources...`
    );

    const allHazardData = await Promise.all(
      externalSources.map(async (externalSource) => {
        try {
          const hazards = await fetchHazardsFromSource(
            externalSource,
            availableCategories
          );

          console.log(
            `---------------------------------------> Fetched ${hazards.length} hazards from ${externalSource.name}`
          );
          return hazards;
        } catch (error) {
          console.error(`Error fetching from ${externalSource.name}:`, error);
          return [];
        }
      })
    ).then((results) => results.flat());

    console.log(
      `---------------------------------------> Total hazards fetched from all sources: ${allHazardData.length}`,
      allHazardData
    );

    if (allHazardData.length === 0) {
      console.log(
        "---------------------------------------> No hazards to process"
      );
      return [];
    }

    // Step 2: Process all hazards together with summarizeAndPostHazards
    const createdHazards = await summarizeAndPostHazards({
      hazardDatas: allHazardData,
      syncOption,
    });

    console.log(
      `---------------------------------------> Successfully processed ${
        createdHazards.length
      } total hazards from all sources. Geocoding cache size: ${getGeocodingCacheSize()}`
    );
    return createdHazards;
    return [];
  } catch (error) {
    console.error("Error during hazard sync from different sources:", error);
    return [];
  }
};

/**
 * Summarizes and posts hazards to the database.
 * Sends notifications for newly created hazards.
 *
 * @param hazardDatas Array of hazard data to be summarized and posted.
 * @param awsCompliantCategories Optional array of AWS compliant category IDs. This will mark hazards as AWS compliant if their category is in this list.
 * @param allowedSeverities Optional array of allowed severities for the hazards.
 * @returns Array of created Hazard objects.
 */
const summarizeAndPostHazards = async ({
  hazardDatas,
  syncOption,
}: {
  hazardDatas: HazardDataWithRelations[];
  syncOption: SyncHazardsFromExternalSourceOption;
}): Promise<Hazard[]> => {
  try {
    console.log(
      `---------------------------------------> Processing ${hazardDatas.length} hazards with rate limiting...`
    );

    // Step 1: Check for existing hazards and prepare for geocoding based on sync option
    const hazardsToProcess: Array<{
      hazardData: HazardDataWithRelations;
      isUpdate: boolean;
    }> = [];

    for (const hazardData of hazardDatas) {
      if (!hazardData.id) continue;

      try {
        const existing = await prisma.hazard.findUnique({
          where: { id: hazardData.id },
        });

        if (existing) {
          // Handle different sync options
          if (
            syncOption === SyncHazardsFromExternalSourceOption.ignoreExisting
          ) {
            // Only skip if the content has not changed
            if (existing.description === hazardData.description) {
              console.log("Hazard already exists, ignoring:", hazardData.title);
              continue;
            }
            // Process if content has changed
            console.log("Hazard content changed, updating:", hazardData.title);
            hazardsToProcess.push({
              hazardData,
              isUpdate: true,
            });
          } else if (
            syncOption === SyncHazardsFromExternalSourceOption.deleteExisting
          ) {
            console.log(
              "Deleting existing hazard to recreate:",
              hazardData.title
            );
            // Delete the existing hazard first
            await prisma.hazard.delete({
              where: { id: hazardData.id },
            });
            // Add to processing list as a new creation (not an update)
            hazardsToProcess.push({
              hazardData,
              isUpdate: false,
            });
          } else if (
            syncOption === SyncHazardsFromExternalSourceOption.replaceExisting
          ) {
            console.log("Replacing existing hazard:", hazardData.title);
            hazardsToProcess.push({
              hazardData,
              isUpdate: true,
            });
          }
        } else {
          // No existing hazard, add as new
          hazardsToProcess.push({
            hazardData,
            isUpdate: false,
          });
        }
      } catch (error) {
        console.log("Error checking existing hazard:", error);
      }
    }

    if (hazardsToProcess.length === 0) {
      return [];
    }

    // Step 2: Geocode hazards sequentially to avoid overloading geocoding service
    const geocodedHazards: Array<{
      hazardData: HazardDataWithRelations;
      isUpdate: boolean;
    }> = [];

    for (const { hazardData, isUpdate } of hazardsToProcess) {
      try {
        const populatedHazard = await populateHazardWithGeocoding(hazardData);

        if (!populatedHazard.latitude || !populatedHazard.longitude) {
          console.log(
            "Hazard missing coordinates after geocoding, skipping:",
            populatedHazard.title
          );
          continue;
        }

        geocodedHazards.push({
          hazardData: populatedHazard,
          isUpdate,
        });
      } catch (error) {
        console.log("Error during geocoding:", error);
      }
    }

    if (geocodedHazards.length === 0) {
      console.log("No hazards left after geocoding");
      return [];
    }

    // Step 3: Process each hazard individually (summarize -> post) with rate limiting
    const createdHazards = await processBatchWithRateLimit(
      geocodedHazards,
      async ({ hazardData, isUpdate }) => {
        try {
          // Summarize the hazard first
          const summarized = await summarizeHazard({
            title: hazardData.title,
            description: hazardData.description,
            locationName: hazardData.locationName,
            latitude: Number(hazardData.latitude),
            longitude: Number(hazardData.longitude),
            categoryName: hazardData.category?.name || "Other",
            sourceName: hazardData.source?.name || "Unknown",
            isAwsCompliant: hazardData.isAwsCompliant ?? false,
            severityBand: hazardData.severityBand || HazardSeverityBand.info,
          });

          // Calculate confidence score for ingested hazard (official source)
          let confidenceScore = 75; // Default high score for official sources
          try {
            const hazardForCalculation: HazardForConfidenceCalculation = {
              severity: hazardData.severity || HazardSeverity.unknown,
              aiConfidence: summarized.confidence,
              upvoteCount: 0,
              downvoteCount: 0,
              createdAt: new Date(),
              reportedBy: null, // Official sources don't have reporters
            };

            confidenceScore = calculateConfidenceScore(hazardForCalculation);
          } catch (error) {
            console.error(
              "Error calculating confidence score for ingested hazard:",
              error
            );
            confidenceScore = 75; // Fallback for official sources
          }

          // Prepare the hazard data with AI summary
          const finalHazardData: HazardDataWithRelations = {
            ...hazardData,
            title: summarized.title || hazardData.title,
            aiSummary: summarized.summary,
            aiConfidence: summarized.confidence,
            callToAction: summarized.callToAction,
            reviewStatus: HazardReviewStatus.accepted,
            reviewedAt: new Date(),
            confidenceScore,
            confidenceScoreCalculatedAt: new Date(),
            expiresAt:
              hazardData.expiresAt ||
              getHazardExpiryDateFromSeverity(
                hazardData.severity || HazardSeverity.unknown
              ),
          };

          // Immediately post the hazard after summarization
          if (!finalHazardData.id) {
            console.log("Hazard missing ID, skipping:", finalHazardData.title);
            return null;
          }

          let createdHazard: Hazard;

          if (
            syncOption === SyncHazardsFromExternalSourceOption.deleteExisting &&
            !isUpdate
          ) {
            // For deleteExisting option, when isUpdate is false, it means we deleted the existing record
            // so we should create a new one
            createdHazard = await prisma.hazard.create({
              data: convertHazardDataWithRelationsToCreateInput(
                finalHazardData
              ),
              include: buildHazardInclude(),
            });
          } else {
            // For replaceExisting or when creating truly new hazards
            createdHazard = await prisma.hazard.upsert({
              where: { id: finalHazardData.id },
              create:
                convertHazardDataWithRelationsToCreateInput(finalHazardData),
              update:
                convertHazardDataWithRelationsToCreateInput(finalHazardData),
              include: buildHazardInclude(),
            });
          }

          console.log(
            `${isUpdate ? "Updated" : "Created"} hazard:`,
            finalHazardData.title
          );

          // Send push notifications to users who subscribed to this area when a new hazard is created
          sendPushNotificationAboutNewHazard(createdHazard);

          // Send socket events to users who subscribed to this area when a new hazard is created
          sendSocketEventAboutHazardToSubscribers({
            hazard: createdHazard,
            socketEvent: SocketEvent.newHazard,
          });

          return createdHazard;
        } catch (error) {
          console.log("Error during summarization and posting:", error);
          return null;
        }
      },
      25, // Process 25 at a time
      2000 // Wait 2 seconds between batches
    );

    // Filter out null results to get the final list of created hazards
    const validCreatedHazards = createdHazards.filter(
      (h): h is NonNullable<typeof h> => h !== null
    );

    console.log(`Successfully processed ${validCreatedHazards.length} hazards`);
    return validCreatedHazards;
  } catch (error) {
    console.error("Error during hazard summarization and posting:", error);
    return [];
  }
};

/**
 * Generic helper function to fetch hazards from an external source.
 * Handles common patterns: upsert source, fetch data, parse, and map with IDs.
 */
const fetchHazardsFromSource = async <T = any>(
  externalSource: ExternalSource,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  const {
    id,
    name,
    url,
    apiUrl,
    apiUrls,
    fetchOptions,
    parseFunction,
    preCheck,
  } = externalSource;

  try {
    // Run pre-check if provided
    if (preCheck) {
      const checkResult = await preCheck();
      if (typeof checkResult === "object" && checkResult.skip) {
        if (checkResult.message) {
          console.warn(checkResult.message);
        }
        return [];
      }
    }

    const externalSourceBasicInfo = {
      id: id,
      name: name,
      url: url,
    };

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: { id: externalSourceBasicInfo.id },
      create: externalSourceBasicInfo,
      update: externalSourceBasicInfo,
    });

    // Handle single URL
    if (apiUrl) {
      // Check if parseFunction is async (RSS feeds)
      if (parseFunction.length === 0) {
        const hazards = await (
          parseFunction as () => Promise<HazardDataWithRelations[]>
        )();
        return hazards.map((hazard) => ({
          ...hazard,
          source: source,
          id: hazard.id || generateHazardId(hazard),
        }));
      }

      // Standard JSON API fetching
      const response = await fetch(apiUrl, fetchOptions);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${name} data: ${response.statusText}`);
      }

      const data = await response.json();
      const hazards = (parseFunction as (data: T) => HazardDataWithRelations[])(
        data
      );

      return hazards.map((hazard) => ({
        ...hazard,
        source: source,
        id: hazard.id || generateHazardId(hazard),
      }));
    }

    // Handle multiple URLs
    if (apiUrls && apiUrls.length > 0) {
      const hazardsPromises = apiUrls.map(async (singleUrl) => {
        try {
          const response = await fetch(singleUrl, fetchOptions);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch ${name} data from ${singleUrl}: ${response.statusText}`
            );
          }

          const data = await response.json();
          const hazards = (
            parseFunction as (
              data: T,
              source?: any
            ) => HazardDataWithRelations[]
          )(data, source);

          return hazards.map((hazard) => ({
            ...hazard,
            source: source,
            id: hazard.id || generateHazardId(hazard),
          }));
        } catch (error) {
          console.error(`Error fetching ${name} from ${singleUrl}:`, error);
          return [];
        }
      });

      const hazardsArrays = await Promise.all(hazardsPromises);
      return hazardsArrays.flat();
    }

    return [];
  } catch (error) {
    console.error(`Error fetching ${name} data:`, error);
    return [];
  }
};

/**
 * Generates a deterministic hash for a hazard-like object.
 * Only uses stable fields (exclude timestamps, etc.)
 */
export function generateHazardId(obj: HazardDataWithRelations): string {
  // Create a stable copy with selected identifying fields
  const data = {
    title: obj.title,
    description: obj.description,
    latitude: obj.latitude,
    longitude: obj.longitude,
    severity: obj.severity,
  };

  // Convert to string and hash
  const str = JSON.stringify(data);
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}
