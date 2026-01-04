import {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
  type Hazard,
  type HazardCategory,
} from "@prisma/client";
import {
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
  parseSmartravellerToHazards,
  parseWAWarningsToHazards,
  parseBOMFeedToHazards,
  parseWAIncidentsToHazards,
  cleanupLocationExtractionCache,
  getCachedLocationExtraction,
  setCachedLocationExtraction,
  parseUSGSEarthquakeToHazards,
  parseQLDTrafficToHazards,
} from "../utils/ingestion.util.js";
import * as crypto from "crypto";
import prisma from "../utils/prisma_client.util.js";
import { summarizeHazard } from "./hazard.service.js";
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
import {
  getAllSubHazardCategories,
  MainCategoryId,
  SubCategoryId,
} from "./hazard_category.service.js";
import { SyncHazardsFromExternalSourceOption } from "../enums/sync_hazards_from_external_source_option_types.js";
import type { HazardDataWithRelations } from "../models/hazard_data_with_relations_interface.js";
import { executePrompt, processBatchWithRateLimit } from "./open-ai.service.js";
import { getAIPromptConfiguration } from "./configuration.service.js";
import { getPromptById } from "./ai-prompt.service.js";
import { HttpError } from "../models/http_error.js";
import {
  AustralianStateBomAPIs,
  AustralianStates,
} from "../enums/australian_state_types.js";

export enum ExternalSourceId {
  rfs = "rfs",
  bom = "bom",
  nswTransport = "nswTransport",
  actEs = "actEs",
  cfs = "cfs",
  viceFire = "viceFire",
  qldFire = "qldFire",
  ntFireAndRescue = "ntFireAndRescue",
  waqi = "waqi",
  openMeteo = "openMeteo",
  smartraveller = "smartraveller",
  waDfes = "waDfes",
  earthquakeUsgs = "earthquakeUsgs",
  qldTraffic = "qldTraffic",
}

// Configuration for hazard sources
interface ExternalSource {
  id: ExternalSourceId;
  name: string;
  url: string;
  imageUrl?: string;

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

  /**
   * Optional severity band filter configuration.
   * If provided, only hazards with these severity bands will be created.
   * However, if an existing hazard drops below the minimum severity, it will be updated to reflect the change.
   */
  severityBandFilter?:
    | {
        /** Minimum severity bands to create new hazards (e.g., ['monitor', 'action', 'critical']) */
        minimumSeverityBands: HazardSeverityBand[];
      }
    | undefined;
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
        imageUrl:
          "https://www.rfs.nsw.gov.au/__data/assets/image/0016/961/rfs-logo-main.png?v=0.3.3",
        apiUrl: "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json",
        parseFunction: (responseData: any) =>
          parseGeoJsonToHazards({
            data: responseData,
            availableCategories,
            idPrefix: ExternalSourceId.rfs,
            dateFormat: "DD/MM/YYYY",
          }),
      },
      ...Object.values(AustralianStates).map((state) => ({
        id: ExternalSourceId.bom,
        name: "BoM",
        url: "https://www.bom.gov.au",
        imageUrl: "",
        apiUrl: AustralianStateBomAPIs[state],
        parseFunction: () =>
          parseBOMFeedToHazards({
            url: AustralianStateBomAPIs[state],
            availableCategories,
            australianState: state,
          }),
      })),
      {
        id: ExternalSourceId.nswTransport,
        name: "NSW Transport",
        url: "https://www.transport.nsw.gov.au",
        imageUrl:
          "https://www.transport.nsw.gov.au/themes/tfnsw_corp_theme/source/tfnsw/components/header/images/logo-TfNSW.png",
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
        imageUrl:
          "https://www.act.gov.au/__data/assets/image/0019/2541430/ACTGov_inline_black.png",
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
        imageUrl:
          "https://www.cfs.sa.gov.au/custom/templates_images/CFS_State_Badge.svg",
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
        imageUrl: "",
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
        imageUrl: "",
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
        imageUrl: "https://nt.gov.au/_design/css/main.css/ntg-logo-mono.svg",
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
        imageUrl: "https://www.waqi.info/images/logo.png",
        apiUrl: `https://api.waqi.info/map/bounds/?latlng=${australiaBounds}&token=${config.waqiApi.apiToken}`,
        severityBandFilter: {
          minimumSeverityBands: [
            HazardSeverityBand.action,
            HazardSeverityBand.critical,
          ],
        },
        parseFunction: (responseData: any) => {
          if (!responseData.data || responseData.data.length === 0) {
            console.log("No WAQI data found for Australia.");
            return [];
          }

          const airQualityAlertCategory = availableCategories.find(
            (cat) => cat.id === "airQualityAlert"
          );
          if (!airQualityAlertCategory) {
            console.log(
              "Air Quality Alert category not found, skipping WAQI hazards."
            );
            return [];
          }

          return parseWAQIToHazards({
            data: responseData.data,
            category: airQualityAlertCategory,
          });
        },
      },
      {
        id: ExternalSourceId.openMeteo,
        name: "Open-Meteo",
        url: "https://open-meteo.com",
        imageUrl: "",
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
        severityBandFilter: {
          minimumSeverityBands: [
            HazardSeverityBand.monitor,
            HazardSeverityBand.action,
            HazardSeverityBand.critical,
          ],
        },
        parseFunction: (responseData: any) => {
          const pollenCategory = availableCategories.find(
            (cat: HazardCategory) => cat.id === SubCategoryId.pollen
          );
          const uvCategory = availableCategories.find(
            (cat: HazardCategory) => cat.id === SubCategoryId.uvAlert
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
      {
        id: ExternalSourceId.smartraveller,
        name: "Smartraveller",
        url: "https://www.smartraveller.gov.au",
        imageUrl:
          "https://www.smartraveller.gov.au/themes/custom/smart_traveller/logo-main-st.png",
        apiUrl: "https://www.smartraveller.gov.au/destinations-export",
        parseFunction: (responseData: any) => {
          const parentCategories =
            availableCategories
              ?.map((cat) => cat.parent)
              ?.filter((cat) => cat !== null)
              .reduce<HazardCategory[]>((acc, curr) => {
                if (curr && !acc.find((c) => c.id === curr.id)) {
                  acc.push(curr);
                }
                return acc;
              }, []) || [];

          const securityAndCrimeCategory = parentCategories.find(
            (cat: HazardCategory) => cat.id === MainCategoryId.securityAndCrime
          );
          if (!securityAndCrimeCategory) {
            console.log(
              "Security and Crime category not found, skipping Smartraveller hazards."
            );
            return [];
          }

          return parseSmartravellerToHazards({
            data: responseData,
            category: securityAndCrimeCategory,
          });
        },
      },
      {
        id: ExternalSourceId.waDfes,
        name: "DFES WA",
        url: "https://emergency.wa.gov.au",
        imageUrl: "",
        apiUrl: "https://api.emergency.wa.gov.au/v1/rss/warnings",
        parseFunction: () =>
          parseWAWarningsToHazards({
            url: "https://api.emergency.wa.gov.au/v1/rss/warnings",
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.waDfes,
        name: "DFES WA",
        url: "https://emergency.wa.gov.au",
        imageUrl: "",
        apiUrl: "https://api.emergency.wa.gov.au/v1/rss/incidents",
        parseFunction: () =>
          parseWAIncidentsToHazards({
            url: "https://api.emergency.wa.gov.au/v1/rss/incidents",
            availableCategories,
          }),
      },
      {
        id: ExternalSourceId.earthquakeUsgs,
        name: "USGS Earthquake Hazards Program",
        url: "https://earthquake.usgs.gov",
        apiUrl:
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
        parseFunction: (responseData: any) => {
          const earthquakeCategory = availableCategories.find(
            (cat) => cat.id === SubCategoryId.earthquake
          );
          if (!earthquakeCategory) {
            console.log(
              "Earthquake category not found, skipping USGS Earthquake hazards."
            );
            return [];
          }

          return parseUSGSEarthquakeToHazards({
            data: responseData,
            earthquakeCategory,
          });
        },
      },
      {
        id: ExternalSourceId.qldTraffic,
        name: "QLD Traffic",
        url: "https://qldtraffic.qld.gov.au",
        imageUrl:
          "https://qldtraffic.qld.gov.au/assets/img/qld-traffic-logo.svg",
        apiUrl:
          "https://api.qldtraffic.qld.gov.au/v2/events?apikey=3e83add325cbb69ac4d8e5bf433d770b",
        parseFunction: (responseData: any) =>
          parseQLDTrafficToHazards({
            data: responseData,
            availableCategories,
          }),
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
          const hazards = await fetchHazardsFromSource(externalSource);

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
      `---------------------------------------> Total hazards fetched from all sources: ${allHazardData.length}`
    );

    if (allHazardData.length === 0) {
      console.log(
        "---------------------------------------> No hazards to process"
      );
      return [];
    }

    // // Step 2: Process all hazards together with summarizeAndPostHazards
    const severityBandFilters = new Map<
      ExternalSourceId,
      HazardSeverityBand[]
    >();
    externalSources.forEach((source) => {
      if (source.severityBandFilter) {
        severityBandFilters.set(
          source.id,
          source.severityBandFilter.minimumSeverityBands
        );
      }
    });

    const createdHazards = await summarizeAndPostHazards({
      hazardDatas: allHazardData,
      syncOption,
      severityBandFilters,
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
 * @param syncOption The sync option to use for existing hazards.
 * @param severityBandFilters Map of source IDs to their severity band filter configurations.
 * @returns Array of created Hazard objects.
 */
export const summarizeAndPostHazards = async ({
  hazardDatas,
  syncOption,
  severityBandFilters,
}: {
  hazardDatas: HazardDataWithRelations[];
  syncOption: SyncHazardsFromExternalSourceOption;
  severityBandFilters: Map<ExternalSourceId, HazardSeverityBand[]>;
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

        // Check if this source has severity band filtering configured
        const sourceId = hazardData.source?.id as ExternalSourceId;
        const minimumSeverityBands = sourceId
          ? severityBandFilters.get(sourceId)
          : undefined;
        const hasSeverityFilter = minimumSeverityBands !== undefined;
        const currentSeverityBand =
          hazardData.severityBand || HazardSeverityBand.info;

        // Apply severity filter logic
        if (hasSeverityFilter) {
          const meetsMinimumSeverity =
            minimumSeverityBands.includes(currentSeverityBand);

          // Skip new hazards that don't meet minimum severity
          if (!existing && !meetsMinimumSeverity) {
            console.log(
              `[${hazardData.source?.id}] Skipping hazard with severity ${currentSeverityBand} (below minimum):`,
              hazardData.title
            );
            continue;
          }

          // Expire existing hazards if they drop below minimum severity
          if (existing && !meetsMinimumSeverity) {
            if (currentSeverityBand === existing.severityBand) {
              console.log(
                `[${hazardData.source?.id}] Skipping hazard with severity ${currentSeverityBand} (below minimum):`,
                hazardData.title
              );
              continue;
            }

            console.log(
              `[${hazardData.source?.id}] Hazard severity downgraded to ${currentSeverityBand}, expiring:`,
              hazardData.title
            );
            await prisma.hazard.update({
              where: { id: existing.id },
              data: {
                expiresAt: new Date(Date.now() - 1000), // Set to 1 second in the past
                description: hazardData.description,
                severityBand: currentSeverityBand,
              },
            });
            continue;
          }
        }

        // Handle existing hazards based on sync option
        if (existing) {
          if (
            syncOption === SyncHazardsFromExternalSourceOption.ignoreExisting
          ) {
            if (existing.description === hazardData.description) {
              console.log(
                `${
                  hasSeverityFilter ? `[${hazardData.source?.id}] ` : ""
                }Hazard already exists, ignoring:`,
                hazardData.title
              );
              continue;
            }
            console.log(
              `${
                hasSeverityFilter ? `[${hazardData.source?.id}] ` : ""
              }Hazard content changed, updating:`,
              hazardData.title
            );
            hazardsToProcess.push({
              hazardData,
              isUpdate: true,
            });
          } else if (
            syncOption === SyncHazardsFromExternalSourceOption.deleteExisting
          ) {
            console.log(
              `${
                hasSeverityFilter ? `[${hazardData.source?.id}] ` : ""
              }Deleting existing hazard to recreate:`,
              hazardData.title
            );
            await prisma.hazard.delete({
              where: { id: hazardData.id },
            });
            hazardsToProcess.push({
              hazardData,
              isUpdate: false,
            });
          } else if (
            syncOption === SyncHazardsFromExternalSourceOption.replaceExisting
          ) {
            console.log(
              `${
                hasSeverityFilter ? `[${hazardData.source?.id}] ` : ""
              }Replacing existing hazard:`,
              hazardData.title
            );
            hazardsToProcess.push({
              hazardData,
              isUpdate: true,
            });
          }
        } else {
          // New hazard - add to processing list
          console.log(
            `${
              hasSeverityFilter
                ? `[${hazardData.source?.id}] Creating new hazard with severity ${currentSeverityBand}:`
                : "Creating new hazard:"
            }`,
            hazardData.title
          );
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
            useDummy: false,
            title: hazardData.title,
            description: hazardData.description,
            locationName: hazardData.locationName,
            category: hazardData.category!,
            source: hazardData.source!,
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

          let expiresAt = hazardData.expiresAt;
          if (!expiresAt) {
            // If no expiry provided, set based on severity
            expiresAt = getHazardExpiryDateFromSeverity(
              hazardData.severity || HazardSeverity.unknown
            );
          }
          if (hazardData.source?.id === ExternalSourceId.smartraveller) {
            // No expiry for smartraveller hazards
            expiresAt = undefined;
          }

          // Prepare the hazard data with AI summary
          const finalHazardData: HazardDataWithRelations = {
            ...hazardData,
            title: summarized.title || hazardData.title,
            aiSummary: hazardData.aiSummary || summarized.summary,
            aiConfidence: summarized.confidence,
            callsToAction: hazardData.callsToAction || summarized.callsToAction,
            reviewStatus: HazardReviewStatus.accepted,
            reviewedAt: new Date(),
            confidenceScore,
            confidenceScoreCalculatedAt: new Date(),
            ...(expiresAt && { expiresAt }),
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
  externalSource: ExternalSource
): Promise<HazardDataWithRelations[]> => {
  const {
    id,
    name,
    url,
    imageUrl,
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
      ...(imageUrl && { imageUrl }),
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
export const generateHazardId = (obj: HazardDataWithRelations): string => {
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
};

/**
 * Extracts location names from a given text using AI.
 *
 * The AI analyzes the text and returns a list of region, district, area, or state names mentioned.
 * Results are cached to avoid redundant API calls for the same text.
 */
export const getLocationsFromText = async (text: string): Promise<string[]> => {
  // Clean up expired cache entries
  cleanupLocationExtractionCache();

  // Generate cache key from text
  const cacheKey = crypto.createHash("sha256").update(text).digest("hex");

  // Check cache first
  const cached = getCachedLocationExtraction(cacheKey);
  if (cached) {
    return cached.locations;
  }

  const { extractLocationPromptId } = await getAIPromptConfiguration();
  const { content: promptContent, model } = await getPromptById(
    extractLocationPromptId
  );

  const userContent = `Extract locations from this text: "${text}"`;

  const response = await executePrompt({
    model: model,
    systemPromptContent: promptContent,
    userPromptContent: userContent,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(500, "AI location extraction failed: Empty response");
  }

  try {
    const aiResponse = JSON.parse(content) as { locations: string[] };

    // Store in cache
    setCachedLocationExtraction(cacheKey, aiResponse.locations);

    return aiResponse.locations;
  } catch (parseError) {
    console.error(
      "Failed to parse AI location extraction response:",
      parseError
    );
    throw new HttpError(
      500,
      "AI location extraction failed: Invalid response format"
    );
  }
};
