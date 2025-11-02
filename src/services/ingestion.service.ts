import {
  HazardReviewStatus,
  HazardSeverity,
  type Hazard,
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
} from "../utils/ingestion.util.js";
import * as crypto from "crypto";
import prisma from "../utils/prisma_client.util.js";
import { summarizeHazard } from "./hazard.service.js";
import { sendPushNotificationAboutNewHazard } from "./notification.service.js";
import { sendSocketEventAboutHazardToSubscribers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";
import {
  allowedSeveritiesAWS,
  allowedSeveritiesNonAWS,
  buildHazardInclude,
  getHazardExpiryDateFromSeverity,
} from "../utils/hazard.util.js";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "./confidence_score.service.js";
import { config } from "../utils/config.js";

// Configuration for hazard sources
interface HazardSourceConfig {
  /// The name of the hazard source
  name: string;

  /// The category ID to assign to hazards from this source
  categoryId: string;

  /// The allowed severities for hazards from this source
  ///
  /// If not provided, all severities are allowed
  allowedSeverities?: HazardSeverity[];

  /// Whether the source is compliant with Australian Warnings System (AWS) standards
  isAwsCompliant: boolean;

  /// Function to fetch hazard data from the source
  fetchFunction: (categoryId: string) => Promise<Prisma.HazardCreateInput[]>;
}

/**
 * Syncs hazards from different sources to the database.
 *
 * Fetches data from all configured sources, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromDifferentSources = async () => {
  try {
    // Clean up expired cache entries
    cleanupGeocodingCache();

    const allCategories = await prisma.hazardCategory.findMany({
      select: { id: true },
    });
    const availableCategories = allCategories.map((cat) => cat.id);

    const sources: HazardSourceConfig[] = [
      // {
      //   name: "RFS",
      //   categoryId: "bushfire",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsDataFromRFS,
      // },
      // {
      //   name: "BoM",
      //   categoryId: "weatherAndEnvironment",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsDataFromBoM,
      // },
      // {
      //   name: "NSW Transport live traffic hazards",
      //   categoryId: "transportAndTravel",
      //   allowedSeverities: allowedSeveritiesNonAWS,
      //   isAwsCompliant: false,
      //   fetchFunction: getHazardsDataFromLiveTrafficHazards,
      // },
      // {
      //   name: "NSW air quality",
      //   categoryId: "weatherAndEnvironment",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsDataFromAirQuality,
      // },
      // {
      //   name: "ACT Emergency Services",
      //   categoryId: "healthAndEmergency",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsDataFromACT,
      // },
      // {
      //   name: "CFS",
      //   categoryId: "bushfire",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsDataFromCFS,
      // },
      // {
      //   name: "Vice Fire Services",
      //   categoryId: "bushfire",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsDataFromViceFireServices,
      // },
      {
        name: "QLD Fire Department",
        categoryId: "bushfire",
        allowedSeverities: allowedSeveritiesAWS,
        isAwsCompliant: true,
        fetchFunction: getHazardsDataFromQLDFireDepartment,
      },
      // {
      //   name: "NT Fire and Rescue",
      //   categoryId: "bushfire",
      //   allowedSeverities: allowedSeveritiesAWS,
      //   isAwsCompliant: true,
      //   fetchFunction: getHazardsFromNTFireAndRescue,
      // },
    ];

    await Promise.all(
      sources.map((source) =>
        syncHazardsFromSource(source, availableCategories)
      )
    );
  } catch (error) {
    console.error("Error during hazard sync from different sources:", error);
  }
};

/**
 * Syncs hazards from a single source to the database.
 *
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
const syncHazardsFromSource = async (
  sourceConfig: HazardSourceConfig,
  availableCategories: string[]
) => {
  try {
    const category = await prisma.hazardCategory.findFirst({
      where: { id: sourceConfig.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new Error(`Hazard category '${sourceConfig.categoryId}' not found`);
    }

    const hazards = await sourceConfig.fetchFunction(category.id);

    console.log(
      `------------------------------------> Fetched ${hazards.length} hazards from ${sourceConfig.name}.`
    );

    const createdHazards = await summarizeAndPostHazards({
      hazardDatas: hazards,
      availableCategories,
      ...(sourceConfig.allowedSeverities && {
        allowedSeverities: sourceConfig.allowedSeverities,
      }),
      isAwsCompliant: sourceConfig.isAwsCompliant,
    });

    console.log(
      `------------------------------------> Sync complete. Created ${
        createdHazards.length
      } new hazards from ${
        sourceConfig.name
      }. Geocoding cache size: ${getGeocodingCacheSize()}`
    );
  } catch (error) {
    console.error(`Error during ${sourceConfig.name} hazard sync:`, error);
  }
};

/**
 * Summarizes and posts hazards to the database.
 * Sends notifications for newly created hazards.
 *
 * @param hazardDatas Array of hazard data to be summarized and posted.
 * @param availableCategories Optional array of available category IDs to validate against.
 * @param allowedSeverities Optional array of allowed severities for the hazards.
 * @returns Array of created Hazard objects.
 */
const summarizeAndPostHazards = async ({
  hazardDatas,
  availableCategories,
  allowedSeverities,
  isAwsCompliant = false,
}: {
  hazardDatas: Prisma.HazardCreateInput[];
  availableCategories?: string[];
  allowedSeverities?: HazardSeverity[];
  isAwsCompliant: boolean;
}): Promise<Hazard[]> => {
  try {
    const summarizedHazardPromises: Promise<Prisma.HazardCreateInput | null>[] =
      [];
    const createdHazardPromises: Promise<Hazard | null>[] = [];

    for (const hazardData of hazardDatas) {
      if (!hazardData.id) continue;

      const promise = prisma.hazard
        .findUnique({
          where: { id: hazardData.id },
        })
        .then((existing) => {
          if (existing?.description === hazardData.description) {
            console.log("Hazard already exists, skipping:", hazardData.title);
            return null;
          }

          // Only geocode if we don't have existing hazard and missing geocoding info
          return populateHazardWithGeocoding(hazardData)
            .then((populatedHazard) => {
              if (!populatedHazard.latitude || !populatedHazard.longitude) {
                console.log(
                  "Hazard missing coordinates after geocoding, skipping:",
                  populatedHazard.title
                );
                return null;
              }

              // check if existing in the dumped json file
              return summarizeHazard({
                title: populatedHazard.title,
                description: populatedHazard.description,
                locationName: populatedHazard.locationName,
                latitude: Number(populatedHazard.latitude),
                longitude: Number(populatedHazard.longitude),
                availableCategories,
                allowedSeverities,
              })
                .then((summarized) => {
                  // Calculate confidence score for ingested hazard (official source)
                  let confidenceScore = 75; // Default high score for official sources
                  try {
                    const hazardForCalculation: HazardForConfidenceCalculation =
                      {
                        severity: summarized.severity,
                        aiConfidence: summarized.confidence,
                        upvoteCount: 0,
                        downvoteCount: 0,
                        createdAt: new Date(),
                        reportedBy: null, // Official sources don't have reporters
                      };

                    confidenceScore =
                      calculateConfidenceScore(hazardForCalculation);
                  } catch (error) {
                    console.error(
                      "Error calculating confidence score for ingested hazard:",
                      error
                    );
                    confidenceScore = 75; // Fallback for official sources
                  }

                  return {
                    ...hazardData,
                    title: summarized.title || hazardData.title,
                    shortDescription: summarized.shortDescription,
                    aiSummary: summarized.summary,
                    aiConfidence: summarized.confidence,
                    severity: summarized.severity,
                    callToAction: summarized.callToAction,
                    isAwsCompliant,
                    reviewStatus: HazardReviewStatus.accepted,
                    reviewedAt: new Date(),
                    confidenceScore,
                    confidenceScoreCalculatedAt: new Date(),
                    ...(summarized.category && {
                      category: {
                        connect: {
                          id: summarized.category,
                        },
                      },
                    }),
                    expiresAt:
                      hazardData.expiresAt ||
                      getHazardExpiryDateFromSeverity(summarized.severity),
                  };
                })
                .catch((error: any) => {
                  console.log("Error during summarization:", error);
                  return null;
                });
            })
            .catch((error: any) => {
              console.log("Error during geocoding:", error);
              return null;
            });
        })
        .catch((error: any) => {
          console.log("Error checking existing hazard:", error);
          return null;
        });

      summarizedHazardPromises.push(promise);
    }

    const summarizedHazards = (
      await Promise.all(summarizedHazardPromises)
    ).filter((h) => h !== null);

    for (const summarizedHazard of summarizedHazards) {
      if (!summarizedHazard) continue;
      if (!summarizedHazard.id) continue;

      const promise = prisma.hazard
        .upsert({
          where: { id: summarizedHazard.id! },
          create: summarizedHazard,
          update: summarizedHazard,
          include: buildHazardInclude(),
        })
        .then((createdHazard) => {
          console.log("Created hazard:", summarizedHazard.title);

          // Send push notifications to users who subscribed to this area when a new hazard is created
          sendPushNotificationAboutNewHazard(createdHazard);

          // Send socket events to users who subscribed to this area when a new hazard is created
          sendSocketEventAboutHazardToSubscribers({
            hazard: createdHazard,
            socketEvent: SocketEvent.newHazard,
          });

          return createdHazard;
        })
        .catch((error) => {
          console.log("Error creating hazard:", error);
          return null;
        });

      createdHazardPromises.push(promise);
    }

    const createdHazards = (await Promise.all(createdHazardPromises)).filter(
      (h) => h !== null
    );

    return createdHazards;
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
  try {
    const url = "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const rfsSource = await prisma.hazardSource.upsert({
      where: {
        url,
      },
      create: {
        name: "NSW Rural Fire Service",
        url,
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseGeoJsonToHazards(data, categoryId, "rfs");

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: rfsSource.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
  try {
    const url =
      "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records?limit=20";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch BoM data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const bomSource = await prisma.hazardSource.upsert({
      where: {
        url,
      },
      create: {
        name: "Bureau of Meteorology",
        url,
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseBoMWarningsToHazards(data, categoryId);

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: bomSource.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
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
        url: "https://opendata.transport.nsw.gov.au/dataset/live-traffic-hazards",
      },
      create: {
        name: "NSW Transport Live Traffic Hazards",
        url: "https://opendata.transport.nsw.gov.au/dataset/live-traffic-hazards",
      },
      update: {},
    });

    const hazardsPromises: Promise<Prisma.HazardCreateInput[]>[] = [];

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
          const hazards = parseGeoJsonToHazards(
            data,
            categoryId,
            "nsw-transport"
          );

          return hazards.map((hazard) => ({
            ...hazard,
            source: {
              connect: {
                id: source.id,
              },
            },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
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
        url,
      },
      create: {
        name: "NSW Air Quality",
        url,
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseAirQualityToHazards(data, categoryId);

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: source.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
  try {
    const url = "https://esa.act.gov.au/feeds/currentincidents.xml";

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        url,
      },
      create: {
        name: "ACT Emergency Services",
        url,
      },
      update: {},
    });

    const hazards = await parseRSSFeedToHazards(url, categoryId, "act-es");

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: source.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
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
        url,
      },
      create: {
        name: "SA Country Fire Service",
        url,
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseCFSFeedToHazards(data, categoryId);

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: source.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
  try {
    const url = "https://data.emergency.vic.gov.au/Show?pageId=getIncidentRSS";

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        url,
      },
      create: {
        name: "Vice Fire Service",
        url,
      },
      update: {},
    });

    const hazards = await parseRSSFeedToHazards(url, categoryId, "vice-fire");

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: source.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
  try {
    const url =
      "https://publiccontent.gis.psba.qld.gov.au/content/Feeds/BushfireCurrentIncidents/bushfireAlert.xml";

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        url,
      },
      create: {
        name: "QLD Fire Department",
        url,
      },
      update: {},
    });

    const hazards = await parseRSSFeedToHazards(url, categoryId, "qld-fire");

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: source.id,
        },
      },
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
  categoryId: string
): Promise<Prisma.HazardCreateInput[]> => {
  try {
    const url = "https://www.pfes.nt.gov.au/incidentmap/json/incidents.json";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    // Ensure the source exists before creating hazards
    const source = await prisma.hazardSource.upsert({
      where: {
        url,
      },
      create: {
        name: "NT Fire and Rescue",
        url,
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseNTFireAndRescueToHazards(data, categoryId);

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: source.id,
        },
      },
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
export function generateHazardId(obj: Prisma.HazardCreateInput): string {
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
