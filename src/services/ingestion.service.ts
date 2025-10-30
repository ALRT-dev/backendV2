import { HazardReviewStatus, type Hazard, type Prisma } from "@prisma/client";
import {
  parseAirQualityToHazards,
  parseBoMWarningsToHazards,
  parseCFSFeedToHazards,
  parseGeoJsonToHazards,
  parseNTFireAndRescueToHazards,
  parseRSSFeedToHazards,
} from "../utils/ingestion.util.js";
import crypto from "crypto";
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
  convertAddressToLatLng,
  convertLatLngToAddress,
} from "./google_map.service.js";

/**
 * Syncs hazards from different sources (RFS and BoM) to the database.
 *
 * Fetches data from both sources, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromDifferentSources = async () => {
  try {
    await Promise.all([
      syncHazardsFromRFS(),
      syncHazardsFromBoM(),
      syncHazardsFromLiveTrafficHazards(),
      syncHazardsAirQuality(),
      syncHazardsFromACT(),
      syncHazardsFromCFS(),
      syncHazardsFromViceFireServices(),
      syncHazardsFromQLDFireDepartment(),
      syncHazardsFromNTFireAndRescue(),
    ]);
  } catch (error) {
    console.error("Error during hazard sync from different sources:", error);
  }
};

/**
 * Syncs hazards from the NSW Rural Fire Service (RFS) feed to the database.
 *
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromRFS = async () => {
  try {
    const rfsHazards = await getHazardsDataFromRFS();

    console.log(
      `------------------------------------> Fetched ${rfsHazards.length} hazards from RFS.`
    );

    const createdHazards = await summarizeAndPostHazards(rfsHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from RFS.`
    );
  } catch (error) {
    console.error("Error during RFS hazard sync:", error);
  }
};

/**
 * Syncs hazards from the Bureau of Meteorology (BoM) feed to the database.
 *
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromBoM = async () => {
  try {
    const bomHazards = await getHazardsDataFromBoM();

    console.log(
      `------------------------------------> Fetched ${bomHazards.length} hazards from BoM.`
    );

    const createdHazards = await summarizeAndPostHazards(bomHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from BoM.`
    );
  } catch (error) {
    console.error("Error during BoM hazard sync:", error);
  }
};

/**
 * Syncs hazards from the NSW Transport live traffic hazards feed to the database.
 *
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromLiveTrafficHazards = async () => {
  try {
    const trafficHazards = await getHazardsDataFromLiveTrafficHazards();

    console.log(
      `------------------------------------> Fetched ${trafficHazards.length} hazards from NSW Transport live traffic hazards.`
    );

    const createdHazards = await summarizeAndPostHazards(trafficHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from NSW Transport live traffic hazards.`
    );
  } catch (error) {
    console.error(
      "Error during NSW Transport live traffic hazards sync:",
      error
    );
  }
};

/**
 * Syncs hazards from the NSW Air Quality feed to the database.
 *
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsAirQuality = async () => {
  try {
    const airQualityHazards = await getHazardsDataFromAirQuality();

    console.log(
      `------------------------------------> Fetched ${airQualityHazards.length} hazards from NSW air quality.`
    );

    const createdHazards = await summarizeAndPostHazards(airQualityHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from NSW air quality.`
    );
  } catch (error) {
    console.error("Error during NSW Air Quality sync:", error);
  }
};

/**
 * Syncs hazards from the ACT Emergency Services feed to the database.
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromACT = async () => {
  try {
    const actHazards = await getHazardsDataFromACT();

    console.log(
      `------------------------------------> Fetched ${actHazards.length} hazards from ACT Emergency Services.`
    );

    const createdHazards = await summarizeAndPostHazards(actHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from ACT Emergency Services.`
    );
  } catch (error) {
    console.error("Error during ACT Emergency Services hazard sync:", error);
  }
};

/**
 * Syncs hazards from the SA Country Fire Service (CFS) feed to the database.
 *
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromCFS = async () => {
  try {
    const cfsHazards = await getHazardsDataFromCFS();

    console.log(
      `------------------------------------> Fetched ${cfsHazards.length} hazards from CFS.`
    );

    const createdHazards = await summarizeAndPostHazards(cfsHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from CFS.`
    );
  } catch (error) {
    console.error("Error during CFS hazard sync:", error);
  }
};

/**
 * Syncs hazards from the Vice Fire Services feed to the database.
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromViceFireServices = async () => {
  try {
    const viceFireHazards = await getHazardsDataFromViceFireServices();

    console.log(
      `------------------------------------> Fetched ${viceFireHazards.length} hazards from Vice Fire Services.`
    );

    const createdHazards = await summarizeAndPostHazards(viceFireHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from Vice Fire Services.`
    );
  } catch (error) {
    console.error("Error during Vice Fire Services hazard sync:", error);
  }
};

/**
 * Syncs hazards from the QLD Fire Department feed to the database.
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromQLDFireDepartment = async () => {
  try {
    const qldFireHazards = await getHazardsDataFromQLDFireDepartment();

    console.log(
      `------------------------------------> Fetched ${qldFireHazards.length} hazards from QLD Fire Department feed.`
    );

    const createdHazards = await summarizeAndPostHazards(qldFireHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from QLD Fire Department.`
    );
  } catch (error) {
    console.error("Error during QLD Fire Department hazard sync:", error);
  }
};

/**
 * Syncs hazards from the NT Fire and Rescue feed to the database.
 * Fetches data, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromNTFireAndRescue = async () => {
  try {
    const ntFireHazards = await getHazardsFromNTFireAndRescue();

    console.log(
      `------------------------------------> Fetched ${ntFireHazards.length} hazards from NT Fire and Rescue.`
    );

    const createdHazards = await summarizeAndPostHazards(ntFireHazards);

    console.log(
      `------------------------------------> Sync complete. Created ${createdHazards.length} new hazards from NT Fire and Rescue.`
    );
  } catch (error) {
    console.error("Error during NT Fire and Rescue hazard sync:", error);
  }
};

/**
 * Summarizes and posts hazards to the database.
 * Sends notifications for newly created hazards.
 */
const summarizeAndPostHazards = async (
  hazardDatas: Prisma.HazardCreateInput[]
): Promise<Hazard[]> => {
  try {
    // First, populate missing geocoding information if any
    hazardDatas = await populateHazardsWithGeocoding(hazardDatas);

    const summarizedHazardPromises: Promise<Prisma.HazardCreateInput | null>[] =
      [];
    const createdHazardPromises: Promise<Hazard | null>[] = [];

    for (const hazardData of hazardDatas) {
      if (!hazardData.id) continue;
      if (!hazardData.latitude || !hazardData.longitude) {
        console.log("Hazard missing coordinates, skipping:", hazardData.title);
        continue;
      }

      const promise = prisma.hazard
        .findUnique({
          where: { id: hazardData.id },
        })
        .then((existing) => {
          if (existing?.description === hazardData.description) {
            console.log("Hazard already exists, skipping:", hazardData.title);
            return null;
          }

          // check if existing in the dumped json file
          return summarizeHazard({
            title: hazardData.title,
            description: hazardData.description,
            latitude: Number(hazardData.latitude),
            longitude: Number(hazardData.longitude),
          })
            .then((summarized) => {
              // Calculate confidence score for ingested hazard (official source)
              let confidenceScore = 75; // Default high score for official sources
              try {
                const hazardForCalculation: HazardForConfidenceCalculation = {
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
                reviewStatus: HazardReviewStatus.accepted,
                reviewedAt: new Date(),
                confidenceScore,
                confidenceScoreCalculatedAt: new Date(),
                expiresAt:
                  hazardData.expiresAt ||
                  getHazardExpiryDateFromSeverity(summarized.severity),
              };
            })
            .catch((error) => {
              console.log("Error during summarization:", error);
              return null;
            });
        })
        .catch((error) => {
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
export const getHazardsDataFromRFS = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url = "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
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
    const hazards = parseGeoJsonToHazards(data, category.id, "rfs");

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
export const getHazardsDataFromBoM = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url =
      "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records?limit=20";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch BoM data: ${response.statusText}`);
    }

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
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
    const hazards = parseBoMWarningsToHazards(data, category.id);

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
export const getHazardsDataFromLiveTrafficHazards = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
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

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Traffic & Transport" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Traffic & Transport' not found");
    }

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
            category.id,
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
export const getHazardsDataFromAirQuality = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url =
      "https://www.airquality.nsw.gov.au/_design/air-quality-api/connect-data-files/rest-observations";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch NSW Air Quality data: ${response.statusText}`
      );
    }

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
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
    const hazards = parseAirQualityToHazards(data, category.id);

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
export const getHazardsDataFromACT = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url = "https://esa.act.gov.au/feeds/currentincidents.xml";

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
    }

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

    const hazards = await parseRSSFeedToHazards(url, category.id, "act-es");

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
export const getHazardsDataFromCFS = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url =
      "https://data.eso.sa.gov.au/prod/cfs/criimson/cfs_current_incidents.json";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CFS data: ${response.statusText}`);
    }

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
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
    const hazards = parseCFSFeedToHazards(data, category.id);

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
export const getHazardsDataFromViceFireServices = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url = "https://data.emergency.vic.gov.au/Show?pageId=getIncidentRSS";

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
    }

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

    const hazards = await parseRSSFeedToHazards(url, category.id, "vice-fire");

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
export const getHazardsDataFromQLDFireDepartment = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url =
      "https://publiccontent.gis.psba.qld.gov.au/content/Feeds/BushfireCurrentIncidents/bushfireAlert.xml";

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
    }

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

    const hazards = await parseRSSFeedToHazards(url, category.id, "qld-fire");

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
export const getHazardsFromNTFireAndRescue = async (): Promise<
  Prisma.HazardCreateInput[]
> => {
  try {
    const url = "https://www.pfes.nt.gov.au/incidentmap/json/incidents.json";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
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
    const hazards = parseNTFireAndRescueToHazards(data, category.id);

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

/**
 * Populates hazards with missing geocoding information.
 * If latitude/longitude is missing, it uses the locationName to fetch coordinates.
 * If locationName is missing, it uses latitude/longitude to fetch the address.
 */
const populateHazardsWithGeocoding = async (
  hazards: Prisma.HazardCreateInput[]
): Promise<Prisma.HazardCreateInput[]> => {
  const populatedHazardsPromise: Promise<Prisma.HazardCreateInput>[] = [];

  for (const hazard of hazards) {
    if (!hazard.latitude || !hazard.longitude) {
      if (hazard.locationName) {
        const promise = convertAddressToLatLng(hazard.locationName)
          .then((result) => {
            if (result && result.geometry && result.geometry.location) {
              hazard.latitude = result.geometry.location.lat;
              hazard.longitude = result.geometry.location.lng;
            } else {
              console.warn(
                `Geocoding failed for hazard location: ${hazard.locationName}`
              );
            }
            return hazard;
          })
          .catch((error) => {
            console.error(
              `Error during geocoding for hazard location: ${hazard.locationName}`,
              error
            );
            return hazard;
          });

        populatedHazardsPromise.push(promise);
        continue;
      }
    }

    if (hazard.latitude && hazard.longitude) {
      if (!hazard.locationName) {
        const promise = convertLatLngToAddress(
          hazard.latitude,
          hazard.longitude
        )
          .then((address) => {
            if (address) {
              hazard.locationName = address;
            } else {
              console.warn(
                `Reverse geocoding failed for hazard coordinates: ${hazard.latitude}, ${hazard.longitude}`
              );
            }
            return hazard;
          })
          .catch((error) => {
            console.error(
              `Error during reverse geocoding for hazard coordinates: ${hazard.latitude}, ${hazard.longitude}`,
              error
            );
            return hazard;
          });

        populatedHazardsPromise.push(promise);
        continue;
      }
    }

    populatedHazardsPromise.push(Promise.resolve(hazard));
  }

  return Promise.all(populatedHazardsPromise);
};
