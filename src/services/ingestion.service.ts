import { HazardReviewStatus, type Hazard, type Prisma } from "@prisma/client";
import {
  parseBoMWarningsToHazards,
  parseGeoJsonToHazards,
} from "../utils/ingestion.util.js";
import crypto from "crypto";
import prisma from "../utils/prisma_client.util.js";
import { buildHazardInclude, summarizeHazard } from "./hazard.service.js";
import { sendPushNotificationAboutNewHazard } from "./notification.service.js";
import { sendSocketEventAboutHazardToSubscribers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { getHazardExpiryDateFromSeverity } from "../utils/hazard.util.js";
import {
  calculateConfidenceScore,
  type HazardForConfidenceCalculation,
} from "./confidence_score.service.js";

/**
 * Syncs hazards from different sources (RFS and BoM) to the database.
 *
 * Fetches data from both sources, summarizes it using AI, and stores new hazards in the database.
 * Sends notifications for newly created hazards.
 */
export const syncHazardsFromDifferentSources = async () => {
  try {
    await Promise.all([syncHazardsFromRFS(), syncHazardsFromBoM()]);
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

    console.log(`Fetched ${rfsHazards.length} hazards from RFS feed.`);

    const createdHazards = await summarizeAndPostHazards(rfsHazards);

    console.log(`Sync complete. Created ${createdHazards.length} new hazards.`);
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

    console.log(`Fetched ${bomHazards.length} hazards from BoM feed.`);

    const createdHazards = await summarizeAndPostHazards(bomHazards);

    console.log(`Sync complete. Created ${createdHazards.length} new hazards.`);
  } catch (error) {
    console.error("Error during BoM hazard sync:", error);
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
          if (existing) {
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

      const promise = prisma.hazard
        .create({
          data: summarizedHazard,
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
    const response = await fetch(
      "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json"
    );
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
        url: "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json",
      },
      create: {
        name: "NSW Rural Fire Service",
        url: "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json",
      },
      update: {},
    });

    const data = await response.json();
    const hazards = parseGeoJsonToHazards(data, category.id);

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connect: {
          id: rfsSource.id,
        },
      },
      id: generateHazardId(hazard),
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
    const response = await fetch(
      "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records?limit=20"
    );
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
        url: "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records",
      },
      create: {
        name: "Bureau of Meteorology",
        url: "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records",
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
      id: generateHazardId(hazard),
    }));
  } catch (error) {
    console.error("Error fetching BoM data:", error);
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
