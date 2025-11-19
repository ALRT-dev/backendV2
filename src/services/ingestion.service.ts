import {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
  type Hazard,
  type HazardCategory,
  type HazardSource,
  type Prisma,
} from "@prisma/client";
import {
  parseAirQualityToHazards,
  parseBoMWarningsToHazards,
  parseCFSFeedToHazards,
  parseGeoJsonToHazards,
  parseNTFireAndRescueToHazards,
  parseRSSFeedToHazards,
  populateHazardWithGeocoding,
  cleanupGeocodingCache,
  getGeocodingCacheSize,
  convertHazardDataWithRelationsToCreateInput,
  parseWAQIToHazards,
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

// Configuration for hazard sources
interface HazardSourceConfig {
  // Unique identifier for the hazard source
  id: string;

  // The name of the hazard source
  name: string;

  // Function to fetch hazard data from the source
  fetchFunction: (
    id: string,
    availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
  ) => Promise<HazardDataWithRelations[]>;
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

    const sources: HazardSourceConfig[] = [
      {
        id: "rfs",
        name: "RFS",
        fetchFunction: getHazardsDataFromRFS,
      },
      {
        id: "bom",
        name: "BoM",
        fetchFunction: getHazardsDataFromBoM,
      },
      {
        id: "nsw-transport",
        name: "NSW Transport live traffic hazards",
        fetchFunction: getHazardsDataFromLiveTrafficHazards,
      },
      // {
      //   id: "nsw-air-quality",
      //   name: "NSW air quality",
      //   fetchFunction: getHazardsDataFromAirQuality,
      // },
      {
        id: "act-es",
        name: "ACT Emergency Services",
        fetchFunction: getHazardsDataFromACT,
      },
      {
        id: "cfs",
        name: "CFS",
        fetchFunction: getHazardsDataFromCFS,
      },
      {
        id: "vice-fire",
        name: "Vice Fire Services",
        fetchFunction: getHazardsDataFromViceFireServices,
      },
      {
        id: "qld-fire",
        name: "QLD Fire Department",
        fetchFunction: getHazardsDataFromQLDFireDepartment,
      },
      {
        id: "nt-fire-and-rescue",
        name: "NT Fire and Rescue",
        fetchFunction: getHazardsFromNTFireAndRescue,
      },
      {
        id: "waqi",
        name: "World Air Quality",
        fetchFunction: getHazardsDataFromWAQI,
      },
    ].filter((source) =>
      sourceIds && sourceIds.length > 0 ? sourceIds.includes(source.id) : true
    );

    // Step 1: Fetch all hazards from all sources simultaneously
    console.log(
      `---------------------------------------> Fetching hazards from ${sources.length} sources...`
    );

    const allHazardData = await Promise.all(
      sources.map(async (source) => {
        try {
          const hazards = await source.fetchFunction(
            source.id,
            availableCategories
          );
          console.log(
            `---------------------------------------> Fetched ${hazards.length} hazards from ${source.name}`
          );
          return hazards;
        } catch (error) {
          console.error(`Error fetching from ${source.name}:`, error);
          return [];
        }
      })
    ).then((results) => results.flat());

    console.log(
      `---------------------------------------> Total hazards fetched from all sources: ${allHazardData.length}`
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
 * Fetches hazard data from the NSW Rural Fire Service (RFS) feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromRFS = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url = "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "NSW Rural Fire Service",
        url: "https://www.rfs.nsw.gov.au",
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseGeoJsonToHazards({
      data,
      availableCategories,
      idPrefix: "rfs",
      dateFormat: "DD/MM/YYYY",
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching RFS data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the Bureau of Meteorology (BoM) warnings feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromBoM = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url =
      "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records?limit=20";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch BoM data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "Bureau of Meteorology",
        url: "https://www.bom.gov.au/weather-and-climate/warnings-and-alerts",
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseBoMWarningsToHazards({
      data,
      availableCategories,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching BoM data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the NSW Transport live traffic hazards feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromLiveTrafficHazards = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    if (config.nswTransportApi.apiKey.length === 0) {
      console.warn(
        "NSW Transport API key is not set. Skipping live traffic hazards fetch."
      );
      return [];
    }

    const urls = [
      // "https://api.transport.nsw.gov.au/v1/live/hazards/alpine/open",
      // "https://api.transport.nsw.gov.au/v1/live/hazards/fire/open",
      // "https://api.transport.nsw.gov.au/v1/live/hazards/flood/open",
      "https://api.transport.nsw.gov.au/v1/live/hazards/incident/open",
      "https://api.transport.nsw.gov.au/v1/live/hazards/majorevent/open",
      // "https://api.transport.nsw.gov.au/v1/live/hazards/roadwork/open",
      // "https://api.transport.nsw.gov.au/v1/live/hazards/regional-lga-incident/open",
    ];

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "NSW Transport Live Traffic Hazards",
        url: "https://www.livetraffic.com",
      },
      update: {},
    });

    const hazardsPromises: Promise<HazardDataWithRelations[]>[] = [];

    for (const url of urls) {
      const promise = fetch(url, {
        headers: {
          Authorization: `apikey ${config.nswTransportApi.apiKey}`,
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to fetch live traffic hazards data: ${response.statusText}`
            );
          }

          const data = await response.json();
          const hazards = parseGeoJsonToHazards({
            data,
            availableCategories,
            idPrefix: "nsw-transport",
          });

          return hazards.map((hazard) => ({
            ...hazard,
            source: source,
            id: hazard.id || generateHazardId(hazard),
          }));
        })
        .catch((error) => {
          console.error(
            `Error fetching live traffic hazards from ${url}:`,
            error
          );
          return [];
        });

      hazardsPromises.push(promise);
    }

    const hazardsArrays = await Promise.all(hazardsPromises);
    return hazardsArrays.flat();
  } catch (error) {
    console.error("Error fetching live traffic hazards:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the NSW Air Quality feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromAirQuality = async (
  id: string,
  categoryId: string
): Promise<HazardDataWithRelations[]> => {
  try {
    const url =
      "https://www.airquality.nsw.gov.au/_design/air-quality-api/connect-data-files/rest-observations";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch NSW Air Quality data: ${response.statusText}`
      );
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "NSW Air Quality",
        url,
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseAirQualityToHazards(data, categoryId);

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching NSW Air Quality data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the ACT Emergency Services feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromACT = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url = "https://esa.act.gov.au/feeds/currentincidents.xml";

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "ACT Emergency Services",
        url: "https://esa.act.gov.au/",
      },
      update: {},
    });

    const hazards = await parseRSSFeedToHazards({
      url,
      idPrefix: "act-es",
      availableCategories,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching ACT Emergency Services data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the SA Country Fire Service (CFS) feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromCFS = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url =
      "https://data.eso.sa.gov.au/prod/cfs/criimson/cfs_current_incidents.json";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CFS data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "SA Country Fire Service",
        url: "https://www.cfs.sa.gov.au/warnings-restrictions/warnings/incidents-warnings/",
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseCFSFeedToHazards({
      data,
      availableCategories,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching CFS data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the Vice Fire Service feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromViceFireServices = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url = "https://data.emergency.vic.gov.au/Show?pageId=getIncidentRSS";

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "Vice Fire Service",
        url: "https://emergency.vic.gov.au",
      },
      update: {},
    });

    const hazards = await parseRSSFeedToHazards({
      url,
      idPrefix: "vice-fire",
      availableCategories,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching Vice Fire Service data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the QLD Fire Department feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromQLDFireDepartment = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url =
      "https://publiccontent.gis.psba.qld.gov.au/content/Feeds/BushfireCurrentIncidents/bushfireAlert.xml";

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "QLD Fire Department",
        url: "https://www.fire.qld.gov.au/Current-Incidents",
      },
      update: {},
    });

    const hazards = await parseRSSFeedToHazards({
      url,
      idPrefix: "qld-fire",
      availableCategories,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching Vice Fire Service data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the NT Fire and Rescue feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsFromNTFireAndRescue = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const url = "https://www.pfes.nt.gov.au/incidentmap/json/incidents.json";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "NT Fire and Rescue",
        url: "https://pfes.nt.gov.au/fire-and-rescue-service/fire-incident-map",
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseNTFireAndRescueToHazards({
      data,
      availableCategories,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching NT Fire and Rescue data:", error);
    return [];
  }
};

/**
 * Fetches hazard data from the World Air Quality Index feed
 * and converts it into an array of HazardDataWithRelations objects.
 */
export const getHazardsDataFromWAQI = async (
  id: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): Promise<HazardDataWithRelations[]> => {
  try {
    const australiaBounds = "-44.0,112.0,-10.0,154.0";
    const url = `https://api.waqi.info/map/bounds/?latlng=${australiaBounds}&token=${config.waqiApi.apiToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch WAQI data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        id,
      },
      create: {
        id,
        name: "World Air Quality Index",
        url: "https://waqi.info/",
      },
      update: {},
    });

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      console.log("No WAQI data found for Australia.");
      return [];
    }

    const category = availableCategories.find(
      (cat) => cat.id === "poorAirQuality"
    );
    if (!category) {
      console.log("Air Quality category not found, skipping WAQI hazards.");
      return [];
    }

    const hazards = parseWAQIToHazards({
      data: data.data,
      category,
    });

    return hazards.map((hazard) => ({
      ...hazard,
      source: source,
      id: hazard.id || generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching NT Fire and Rescue data:", error);
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
