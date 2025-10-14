import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import {
  HazardReviewStatus,
  HazardVoteType,
  type Hazard,
  type HazardSeverity,
} from "@prisma/client";
import {
  buildHazardInclude,
  getHazardsApplyingFilters,
  reviewHazard,
  summarizeHazard,
} from "../services/hazard.service.js";
import { getCategoriesApplyingFilters } from "../services/hazardCategory.service.js";
import {
  sendPushNotificationAboutNewHazard,
  sendPushNotificationToUser,
} from "../services/notification.service.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import { sendSocketEventAboutHazardToSubscribers } from "../services/socket.service.js";
import { HttpError } from "../models/http_error.js";
import { getHazardsDataFromRFS } from "../services/ingestion.service.js";
import {
  dumpHazardsToJson,
  getDumpHazardById,
} from "../utils/data_dump.util.js";
import { SocketEvent } from "../models/socket_event_types.js";
import type {
  CreateHazardInput,
  GetHazardsQuery,
  VoteHazardInput,
} from "../validators/hazard.schema.js";

/// Controller to handle fetching hazards with optional filters and pagination.
export const getHazards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      searchString,
      categoryIds,
      reportedById,
      reviewStatus,
      page = "1",
      pageSize = "20",
    }: GetHazardsQuery = req.query;
    const { userId } = res;

    const hazards = await getHazardsApplyingFilters({
      searchString,
      reportedById,
      reviewStatus,
      categoryIds,
      userId,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    res.status(200).json(hazards);
  } catch (error) {
    next(error);
  }
};

export const getHazardsWithCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      searchString,
      categoryIds,
      reportedById,
      reviewStatus,
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      page = "1",
      pageSize = "20",
    }: GetHazardsQuery = req.query;
    const { userId } = res;

    const subscriptionPromise = prisma.locationSubscription.findFirst({
      where: {
        northeastLat: Number(northeastLat),
        northeastLng: Number(northeastLng),
        southwestLat: Number(southwestLat),
        southwestLng: Number(southwestLng),
        userId: userId!,
      },
      select: { id: true },
    });

    const categoriesPromise = getCategoriesApplyingFilters({
      hazardSearchString: searchString,
      hazardReviewStatus: reviewStatus,
      hazardReportedById: reportedById,
      hazardNortheastLat: Number(northeastLat),
      hazardNortheastLng: Number(northeastLng),
      hazardSouthwestLat: Number(southwestLat),
      hazardSouthwestLng: Number(southwestLng),
    });

    const hazardsPromise = getHazardsApplyingFilters({
      searchString,
      categoryIds,
      reviewStatus,
      northeastLat: Number(northeastLat),
      northeastLng: Number(northeastLng),
      southwestLat: Number(southwestLat),
      southwestLng: Number(southwestLng),
      userId,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    const [subscription, categories, hazards] = await Promise.all([
      subscriptionPromise,
      categoriesPromise,
      hazardsPromise,
    ]);

    const subscriptionId = subscription?.id;

    // If no hazards found, return empty categories and hazards
    if (hazards.length === 0) {
      return res
        .status(200)
        .json({ subscriptionId: null, categories: [], hazards: [] });
    }

    res.status(200).json({ subscriptionId, categories, hazards });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle fetching a single hazard by its ID.
export const getHazardById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }

    const hazard = await prisma.hazard.findUnique({
      where: { id },
      include: buildHazardInclude(),
    });

    if (!hazard) {
      return res.status(404).json({ message: "Hazard not found" });
    }

    res.status(200).json(hazard);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle creating a new hazard report.
export const createHazard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      description,
      categoryId,
      latitude,
      longitude,
      severity,
      occurredAt,
    }: CreateHazardInput = req.body;
    const { userId } = res;

    // Validate that category exists
    const category = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new HttpError(400, "Invalid Category ID");
    }

    let review: any;
    try {
      review = await reviewHazard({
        title,
        description,
        latitude,
        longitude,
        severity,
        occurredAt: occurredAt || new Date(),
      });
    } catch (error) {
      console.log("Error during hazard review:", error);
      review = {
        reviewStatus: HazardReviewStatus.pending,
      };
    }

    const {
      reviewStatus,
      reviewFeedback,
      title: suggestedTitle,
      shortDescription,
      summary: aiSummary,
      confidence: aiConfidence,
    } = review;

    const result = await prisma.$transaction(async (tx) => {
      // Create the hazard
      const hazard = await tx.hazard.create({
        data: {
          title: suggestedTitle || title,
          description,
          reviewStatus,
          reviewFeedback,
          ...(reviewStatus === HazardReviewStatus.accepted && {
            reviewedAt: new Date(),
          }),
          shortDescription,
          aiSummary,
          ...(aiConfidence && { aiConfidence }),
          categoryId,
          reportedById: userId,
          latitude,
          longitude,
          severity,
          ...(occurredAt && { occurredAt: new Date(occurredAt) }),
        },
        include: buildHazardInclude(),
      });

      return hazard;
    });

    console.log("Created hazard with review feedback:", result.reviewFeedback);

    if (reviewStatus === HazardReviewStatus.accepted) {
      // Send push notifications to users who subscribed to this area when a new hazard is created
      // This will ignore the user who reported the hazard
      sendPushNotificationAboutNewHazard(result);

      // Send socket events to users who subscribed to this area when a new hazard is created
      // This will NOT ignore the user who reported the hazard
      sendSocketEventAboutHazardToSubscribers({
        hazard: result,
        socketEvent: SocketEvent.newHazard,
      });
    }

    // Now also send a notification to the user who reported the hazard
    if (reviewStatus === HazardReviewStatus.accepted) {
      sendPushNotificationToUser({
        userId: userId!,
        title: "Hazard Reported Successfully",
        body: `Your hazard "${result.title}" has been reported successfully.`,
        data: result,
        type: PushNotificationType.viewHazard,
      });
    } else if (reviewStatus === HazardReviewStatus.rejected) {
      sendPushNotificationToUser({
        userId: userId!,
        title: "Invalid Hazard Report",
        body: `Our review found your hazard report to be invalid. ${reviewFeedback}`,
        data: result,
        type: PushNotificationType.viewHazard,
      });
    }

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/// Controller to handle deleting a hazard by its ID.
export const deleteHazard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new HttpError(400, "Hazard ID is required");
    }

    const hazard = await prisma.hazard.findUnique({
      where: { id },
    });

    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    await prisma.hazard.delete({
      where: { id },
    });

    res.status(200).json({ message: "Hazard deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle voting (upvote/downvote) on a hazard.
export const voteHazard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: hazardId } = req.params;
    const { voteType }: VoteHazardInput = req.body;
    const { userId } = res;

    if (!hazardId) {
      throw new HttpError(400, "Hazard ID is required");
    }

    // Check if the hazard exists
    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      select: { id: true },
    });
    if (!hazard) {
      throw new HttpError(404, "Hazard not found");
    }

    const updatedHazard = await prisma.$transaction(async (tx) => {
      let updatedHazard: Hazard;

      // Check if the user has already voted on this hazard
      const existingVote = await tx.hazardVote.findUnique({
        where: {
          hazardId_userId: {
            hazardId,
            userId: userId!,
          },
        },
      });

      if (!existingVote) {
        // If no existing vote, create a new one
        await tx.hazardVote.create({
          data: {
            hazardId,
            userId: userId!,
            voteType: voteType as HazardVoteType,
          },
        });

        // Also increment the appropriate count in Hazard
        updatedHazard = await tx.hazard.update({
          where: { id: hazardId },
          include: buildHazardInclude(),
          data: {
            upvoteCount: {
              increment: voteType === "upvote" ? 1 : 0,
            },
            downvoteCount: {
              increment: voteType === "downvote" ? 1 : 0,
            },
          },
        });
      } else {
        // If the user has already voted and is trying to vote the same way, then remove the vote
        if (existingVote.voteType === voteType) {
          await tx.hazardVote.delete({
            where: { id: existingVote.id },
          });

          // Decrement the appropriate count in Hazard
          updatedHazard = await tx.hazard.update({
            where: { id: hazardId },
            include: buildHazardInclude(),
            data: {
              upvoteCount: {
                decrement: voteType === "upvote" ? 1 : 0,
              },
              downvoteCount: {
                decrement: voteType === "downvote" ? 1 : 0,
              },
            },
          });
        } else {
          // If the user is changing their vote, update the existing vote
          await tx.hazardVote.update({
            where: { id: existingVote.id },
            data: { voteType: voteType as HazardVoteType },
          });

          // Update the counts in Hazard accordingly
          updatedHazard = await tx.hazard.update({
            where: { id: hazardId },
            include: buildHazardInclude(),
            data: {
              upvoteCount: {
                increment: voteType === "upvote" ? 1 : -1,
              },
              downvoteCount: {
                increment: voteType === "downvote" ? 1 : -1,
              },
            },
          });
        }
      }

      return updatedHazard;
    });

    if (updatedHazard) {
      // Send socket event about updated hazard to subscribers (except the user who voted)
      sendSocketEventAboutHazardToSubscribers({
        hazard: updatedHazard,
        socketEvent: SocketEvent.updateHazard,
        excludeUserIds: [userId!],
      });
    }

    res.status(200).json({ message: "Vote recorded successfully" });
  } catch (error) {
    next(error);
  }
};

/// Controller to handle populating the database with sample hazards and categories.
export const populateHazards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // First, ensure hazard categories exist
    const categories = [
      { name: "Safety & Security", emoji: "🔒" },
      { name: "Traffic & Transport", emoji: "🚗" },
      { name: "Weather & Environment", emoji: "🌧️" },
      { name: "Health & Emergency", emoji: "🚑" },
      { name: "Infrastructure & Services", emoji: "🏗️" },
    ];

    const createdCategories = [];
    for (const category of categories) {
      const existingCategory = await prisma.hazardCategory.findFirst({
        where: { name: category.name },
      });

      if (!existingCategory) {
        const newCategory = await prisma.hazardCategory.create({
          data: category,
        });
        createdCategories.push(newCategory);
      } else {
        createdCategories.push(existingCategory);
      }
    }

    // Sample hazard data based on your requirements
    const sampleHazards = [
      {
        title: "Landslide in Kathmandu",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "A massive landslide has occurred in Kathmandu.",
        latitude: 27.7172,
        longitude: 85.324,
        createdAt: new Date("2025-10-01T10:00:00Z"),
      },
      {
        title: "Flood in Chitwan",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description: "Severe flooding reported in Chitwan area.",
        latitude: 27.5291,
        longitude: 84.3542,
        createdAt: new Date("2025-09-30T12:30:00Z"),
      },
      {
        title: "Earthquake near Pokhara",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "A 5.6 magnitude earthquake struck near Pokhara.",
        latitude: 28.2096,
        longitude: 83.9856,
        createdAt: new Date("2025-09-28T14:15:00Z"),
      },
      {
        title: "Wildfire in Bardiya",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "Wildfire spreading rapidly in Bardiya National Park.",
        latitude: 28.356,
        longitude: 81.491,
        createdAt: new Date("2024-03-04T16:45:00Z"),
      },
      {
        title: "Tornado in Biratnagar",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description: "A tornado has caused damage in Biratnagar region.",
        latitude: 26.4525,
        longitude: 87.2718,
        createdAt: new Date("2023-10-05T18:00:00Z"),
      },
      {
        title: "Flood near Bagmati River",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description:
          "The Bagmati River overflowed due to heavy rainfall, causing localized flooding.",
        latitude: 27.6931,
        longitude: 85.3145,
        createdAt: new Date("2025-10-01T11:00:00Z"),
      },
      {
        title: "Earthquake tremor felt in Thamel",
        categoryName: "Weather & Environment",
        severity: "advice",
        description: "Mild earthquake tremor shook buildings in Thamel area.",
        latitude: 27.7154,
        longitude: 85.3123,
        createdAt: new Date("2025-10-01T11:30:00Z"),
      },
      {
        title: "Wildfire in Shivapuri forest",
        categoryName: "Weather & Environment",
        severity: "emergency",
        description:
          "A wildfire has broken out in the Shivapuri National Park forest area.",
        latitude: 27.8333,
        longitude: 85.3667,
        createdAt: new Date("2025-10-01T12:00:00Z"),
      },
      {
        title: "Building collapse in Baneshwor",
        categoryName: "Infrastructure & Services",
        severity: "emergency",
        description:
          "A residential building collapsed due to weak structure and recent tremors.",
        latitude: 27.7033,
        longitude: 85.3333,
        createdAt: new Date("2025-10-01T12:30:00Z"),
      },
      {
        title: "Tornado spotted in Bhaktapur outskirts",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description:
          "A small tornado was spotted on the outskirts near Bhaktapur, affecting nearby houses.",
        latitude: 27.671,
        longitude: 85.4298,
        createdAt: new Date("2025-10-01T13:00:00Z"),
      },
      {
        title: "Flooded streets in Patan",
        categoryName: "Weather & Environment",
        severity: "advice",
        description:
          "Monsoon rains caused waterlogging in Patan Durbar Square area.",
        latitude: 27.6722,
        longitude: 85.324,
        createdAt: new Date("2025-10-01T13:30:00Z"),
      },
      {
        title: "Gas leak in Baneshwor",
        categoryName: "Health & Emergency",
        severity: "emergency",
        description:
          "A gas leak was reported in a small factory near Baneshwor.",
        latitude: 27.703,
        longitude: 85.3345,
        createdAt: new Date("2025-10-01T14:00:00Z"),
      },
      {
        title: "Fire outbreak in Kalimati market",
        categoryName: "Health & Emergency",
        severity: "emergency",
        description:
          "A fire broke out in the crowded Kalimati vegetable market.",
        latitude: 27.6915,
        longitude: 85.301,
        createdAt: new Date("2025-10-01T14:30:00Z"),
      },
      {
        title: "Power outage in Bhaktapur",
        categoryName: "Infrastructure & Services",
        severity: "info",
        description:
          "Large parts of Bhaktapur experienced blackout due to storm.",
        latitude: 27.671,
        longitude: 85.4298,
        createdAt: new Date("2025-10-01T15:00:00Z"),
      },
      {
        title: "Structural damage at Dharahara",
        categoryName: "Infrastructure & Services",
        severity: "watchAndAct",
        description: "Cracks appeared in Dharahara tower after recent tremors.",
        latitude: 27.7039,
        longitude: 85.3157,
        createdAt: new Date("2025-10-01T15:15:00Z"),
      },
      {
        title: "Earthquake tremors in Lalitpur",
        categoryName: "Weather & Environment",
        severity: "advice",
        description: "People rushed out of their homes after mild tremors.",
        latitude: 27.6588,
        longitude: 85.3247,
        createdAt: new Date("2025-10-01T15:30:00Z"),
      },
      {
        title: "Heavy rainfall in Kirtipur",
        categoryName: "Weather & Environment",
        severity: "advice",
        description: "Continuous rainfall flooded low-lying roads in Kirtipur.",
        latitude: 27.6675,
        longitude: 85.278,
        createdAt: new Date("2025-10-01T16:00:00Z"),
      },
      {
        title: "Small landslide in Sundarijal",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        description:
          "Road blocked due to small landslide near Sundarijal hiking trail.",
        latitude: 27.7892,
        longitude: 85.4253,
        createdAt: new Date("2025-10-01T16:30:00Z"),
      },
      {
        title: "Bridge collapse in Gorkha",
        categoryName: "Infrastructure & Services",
        severity: "emergency",
        description: "A suspension bridge collapsed due to rust and overuse.",
        latitude: 28.0135,
        longitude: 84.6339,
        createdAt: new Date("2025-10-01T17:00:00Z"),
      },
      {
        title: "Robbery reported in New Road",
        categoryName: "Safety & Security",
        severity: "info",
        description: "Two individuals reported being robbed at New Road.",
        latitude: 27.7045,
        longitude: 85.3073,
        createdAt: new Date("2025-10-01T17:30:00Z"),
      },
    ];

    // Clear existing hazards (optional - remove this if you want to keep existing data)
    await prisma.hazard.deleteMany({});

    // Create hazards
    const createdHazards = [];
    for (const hazardData of sampleHazards) {
      const category = createdCategories.find(
        (cat) => cat.name === hazardData.categoryName
      );
      if (!category) {
        console.warn(`Category not found for: ${hazardData.categoryName}`);
        continue;
      }

      const hazard = await prisma.hazard.create({
        data: {
          title: hazardData.title,
          description: hazardData.description,
          categoryId: category.id,
          latitude: hazardData.latitude,
          longitude: hazardData.longitude,
          severity: hazardData.severity as HazardSeverity,
        },
        include: buildHazardInclude(),
      });

      // Update the createdAt timestamp to match the sample data
      await prisma.hazard.update({
        where: { id: hazard.id },
        data: { createdAt: hazardData.createdAt },
      });

      createdHazards.push(hazard);
    }

    res.status(201).json({
      message: `Successfully populated ${createdHazards.length} hazards with ${createdCategories.length} categories`,
      hazards: createdHazards,
      categories: createdCategories,
    });
  } catch (error) {
    next(error);
  }
};

export const populateFromSource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rfsHazards = await getHazardsDataFromRFS();
    const dumpFileName = "rfs_existing_hazards.json";

    const summarizedHazardPromises: Promise<any>[] = [];
    const createdHazardPromises: Promise<any>[] = [];

    const allHazards: any[] = [];

    for (const hazardData of rfsHazards) {
      const promise = prisma.hazard
        .findUnique({
          where: { id: hazardData.id },
        })
        .then((existing) => {
          if (existing) {
            console.log("Hazard already exists, skipping:", hazardData.title);
            allHazards.push(existing);
            return null;
          }

          // check if existing in the dumped json file
          return getDumpHazardById(hazardData.id, dumpFileName).then(
            (dumped) => {
              if (dumped) {
                console.log(
                  "Hazard already exists in dump file, skipping:",
                  hazardData.title
                );
                allHazards.push(dumped);
                return dumped;
              }

              return summarizeHazard({
                title: hazardData.title,
                description: hazardData.description,
                latitude: Number(hazardData.latitude),
                longitude: Number(hazardData.longitude),
              })
                .then((summarized) => {
                  return {
                    ...hazardData,
                    title: summarized.title || hazardData.title,
                    shortDescription: summarized.shortDescription,
                    aiSummary: summarized.summary,
                    aiConfidence: summarized.confidence,
                    severity: summarized.severity,
                  };
                })
                .catch((error) => {
                  console.log("Error during summarization:", error);
                  return null;
                });
            }
          );
        })
        .catch((error) => {
          console.log("Error checking existing hazard:", error);
          return null;
        });

      summarizedHazardPromises.push(promise);
    }

    const summarizedHazards = await Promise.all(summarizedHazardPromises);

    for (const summarizedHazard of summarizedHazards) {
      if (!summarizedHazard) continue;

      const promise = prisma.hazard
        .create({
          data: summarizedHazard,
        })
        .then((createdHazard) => {
          console.log("Created hazard:", summarizedHazard.title);
          allHazards.push(createdHazard);

          // Send push notifications to users who subscribed to this area when a new hazard is created
          // This will ignore the user who reported the hazard
          sendPushNotificationAboutNewHazard(createdHazard);

          // Send socket events to users who subscribed to this area when a new hazard is created
          // This will NOT ignore the user who reported the hazard
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

    const createdHazards = await Promise.all(createdHazardPromises);

    await dumpHazardsToJson(allHazards, dumpFileName);

    res.status(200).json(createdHazards);
  } catch (error) {
    next(error);
  }
};
