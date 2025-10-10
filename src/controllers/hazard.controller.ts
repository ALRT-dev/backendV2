import type { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma_client.util.js";
import type { HazardSeverity } from "@prisma/client";

export const getHazards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      categoryIds,
      searchString,
      page = "1",
      pageSize = "20",
    } = req.query;

    const hazards = await prisma.hazard.findMany({
      where: {
        ...(categoryIds
          ? {
              categoryId: {
                in: Array.isArray(categoryIds)
                  ? (categoryIds as string[])
                  : (categoryIds as string).split(","),
              },
            }
          : {}),
        ...(searchString
          ? {
              OR: [
                {
                  title: {
                    contains: searchString as string,
                    mode: "insensitive",
                  },
                },
                {
                  shortDescription: {
                    contains: searchString as string,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
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
      northeastLat,
      northeastLng,
      southwestLat,
      southwestLng,
      page = 1,
      pageSize = 20,
    } = req.query;

    const subscriptionPromise = prisma.locationSubscription.findFirst({
      where: {
        northeastLat: Number(northeastLat),
        northeastLng: Number(northeastLng),
        southwestLat: Number(southwestLat),
        southwestLng: Number(southwestLng),
      },
      select: { id: true },
    });

    const categoriesPromise = prisma.hazardCategory.findMany({
      where: {
        hazards: {
          some: {
            ...(searchString
              ? {
                  OR: [
                    {
                      title: {
                        contains: searchString as string,
                        mode: "insensitive",
                      },
                    },
                    {
                      shortDescription: {
                        contains: searchString as string,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
            ...(northeastLat && northeastLng && southwestLat && southwestLng
              ? {
                  latitude: {
                    gte: Number(southwestLat),
                    lte: Number(northeastLat),
                  },
                  longitude: {
                    gte: Number(southwestLng),
                    lte: Number(northeastLng),
                  },
                }
              : {}),
          },
        },
      },
      include: {
        _count: {
          select: {
            hazards: {
              where: {
                ...(searchString
                  ? {
                      OR: [
                        {
                          title: {
                            contains: searchString as string,
                            mode: "insensitive",
                          },
                        },
                        {
                          shortDescription: {
                            contains: searchString as string,
                            mode: "insensitive",
                          },
                        },
                      ],
                    }
                  : {}),
                ...(northeastLat && northeastLng && southwestLat && southwestLng
                  ? {
                      latitude: {
                        gte: Number(southwestLat),
                        lte: Number(northeastLat),
                      },
                      longitude: {
                        gte: Number(southwestLng),
                        lte: Number(northeastLng),
                      },
                    }
                  : {}),
              },
            },
          },
        },
      },
      orderBy: {
        hazards: {
          _count: "desc",
        },
      },
    });

    const hazardsPromise = prisma.hazard.findMany({
      where: {
        ...(categoryIds
          ? {
              categoryId: {
                in: Array.isArray(categoryIds)
                  ? (categoryIds as string[])
                  : (categoryIds as string).split(","),
              },
            }
          : {}),
        ...(searchString
          ? {
              OR: [
                {
                  title: {
                    contains: searchString as string,
                    mode: "insensitive",
                  },
                },
                {
                  shortDescription: {
                    contains: searchString as string,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        ...(northeastLat && northeastLng && southwestLat && southwestLng
          ? {
              latitude: {
                gte: Number(southwestLat),
                lte: Number(northeastLat),
              },
              longitude: {
                gte: Number(southwestLng),
                lte: Number(northeastLng),
              },
            }
          : {}),
      },
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    const [subscription, categories, hazards] = await Promise.all([
      subscriptionPromise,
      categoriesPromise,
      hazardsPromise,
    ]);

    const subscriptionId = subscription?.id;

    // Transform categories to include hazardsCount and remove _count
    const transformedCategories = categories.map((category) => ({
      ...category,
      hazardsCount: category._count.hazards,
      _count: undefined,
    }));

    res
      .status(200)
      .json({ subscriptionId, categories: transformedCategories, hazards });
  } catch (error) {
    next(error);
  }
};

export const getHazardById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Hazard ID is required" });
    }

    const hazard = await prisma.hazard.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!hazard) {
      return res.status(404).json({ message: "Hazard not found" });
    }

    res.status(200).json(hazard);
  } catch (error) {
    next(error);
  }
};

export const createHazard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      shortDescription,
      categoryId,
      latitude,
      longitude,
      severity,
      source,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!shortDescription) {
      return res.status(400).json({ message: "Short description is required" });
    }
    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }
    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Location (latitude and longitude) is required" });
    }

    const result = await prisma.hazard.create({
      data: {
        title,
        shortDescription,
        categoryId,
        latitude,
        longitude,
        severity,
        source,
      },
      include: { category: true },
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteHazard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Hazard ID is required" });
    }

    const hazard = await prisma.hazard.findUnique({
      where: { id },
    });

    if (!hazard) {
      return res.status(404).json({ message: "Hazard not found" });
    }

    await prisma.hazard.delete({
      where: { id },
    });

    res.status(200).json({ message: "Hazard deleted successfully" });
  } catch (error) {
    next(error);
  }
};

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
        shortDescription: "A massive landslide has occurred in Kathmandu.",
        latitude: 27.7172,
        longitude: 85.324,
        createdAt: new Date("2025-10-01T10:00:00Z"),
      },
      {
        title: "Flood in Chitwan",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        shortDescription: "Severe flooding reported in Chitwan area.",
        latitude: 27.5291,
        longitude: 84.3542,
        createdAt: new Date("2025-09-30T12:30:00Z"),
      },
      {
        title: "Earthquake near Pokhara",
        categoryName: "Weather & Environment",
        severity: "emergency",
        shortDescription: "A 5.6 magnitude earthquake struck near Pokhara.",
        latitude: 28.2096,
        longitude: 83.9856,
        createdAt: new Date("2025-09-28T14:15:00Z"),
      },
      {
        title: "Wildfire in Bardiya",
        categoryName: "Weather & Environment",
        severity: "emergency",
        shortDescription:
          "Wildfire spreading rapidly in Bardiya National Park.",
        latitude: 28.356,
        longitude: 81.491,
        createdAt: new Date("2024-03-04T16:45:00Z"),
      },
      {
        title: "Tornado in Biratnagar",
        categoryName: "Weather & Environment",
        severity: "emergency",
        shortDescription: "A tornado has caused damage in Biratnagar region.",
        latitude: 26.4525,
        longitude: 87.2718,
        createdAt: new Date("2023-10-05T18:00:00Z"),
      },
      {
        title: "Flood near Bagmati River",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        shortDescription:
          "The Bagmati River overflowed due to heavy rainfall, causing localized flooding.",
        latitude: 27.6931,
        longitude: 85.3145,
        createdAt: new Date("2025-10-01T11:00:00Z"),
      },
      {
        title: "Earthquake tremor felt in Thamel",
        categoryName: "Weather & Environment",
        severity: "advice",
        shortDescription:
          "Mild earthquake tremor shook buildings in Thamel area.",
        latitude: 27.7154,
        longitude: 85.3123,
        createdAt: new Date("2025-10-01T11:30:00Z"),
      },
      {
        title: "Wildfire in Shivapuri forest",
        categoryName: "Weather & Environment",
        severity: "emergency",
        shortDescription:
          "A wildfire has broken out in the Shivapuri National Park forest area.",
        latitude: 27.8333,
        longitude: 85.3667,
        createdAt: new Date("2025-10-01T12:00:00Z"),
      },
      {
        title: "Building collapse in Baneshwor",
        categoryName: "Infrastructure & Services",
        severity: "emergency",
        shortDescription:
          "A residential building collapsed due to weak structure and recent tremors.",
        latitude: 27.7033,
        longitude: 85.3333,
        createdAt: new Date("2025-10-01T12:30:00Z"),
      },
      {
        title: "Tornado spotted in Bhaktapur outskirts",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        shortDescription:
          "A small tornado was spotted on the outskirts near Bhaktapur, affecting nearby houses.",
        latitude: 27.671,
        longitude: 85.4298,
        createdAt: new Date("2025-10-01T13:00:00Z"),
      },
      {
        title: "Flooded streets in Patan",
        categoryName: "Weather & Environment",
        severity: "advice",
        shortDescription:
          "Monsoon rains caused waterlogging in Patan Durbar Square area.",
        latitude: 27.6722,
        longitude: 85.324,
        createdAt: new Date("2025-10-01T13:30:00Z"),
      },
      {
        title: "Gas leak in Baneshwor",
        categoryName: "Health & Emergency",
        severity: "emergency",
        shortDescription:
          "A gas leak was reported in a small factory near Baneshwor.",
        latitude: 27.703,
        longitude: 85.3345,
        createdAt: new Date("2025-10-01T14:00:00Z"),
      },
      {
        title: "Fire outbreak in Kalimati market",
        categoryName: "Health & Emergency",
        severity: "emergency",
        shortDescription:
          "A fire broke out in the crowded Kalimati vegetable market.",
        latitude: 27.6915,
        longitude: 85.301,
        createdAt: new Date("2025-10-01T14:30:00Z"),
      },
      {
        title: "Power outage in Bhaktapur",
        categoryName: "Infrastructure & Services",
        severity: "info",
        shortDescription:
          "Large parts of Bhaktapur experienced blackout due to storm.",
        latitude: 27.671,
        longitude: 85.4298,
        createdAt: new Date("2025-10-01T15:00:00Z"),
      },
      {
        title: "Structural damage at Dharahara",
        categoryName: "Infrastructure & Services",
        severity: "watchAndAct",
        shortDescription:
          "Cracks appeared in Dharahara tower after recent tremors.",
        latitude: 27.7039,
        longitude: 85.3157,
        createdAt: new Date("2025-10-01T15:15:00Z"),
      },
      {
        title: "Earthquake tremors in Lalitpur",
        categoryName: "Weather & Environment",
        severity: "advice",
        shortDescription:
          "People rushed out of their homes after mild tremors.",
        latitude: 27.6588,
        longitude: 85.3247,
        createdAt: new Date("2025-10-01T15:30:00Z"),
      },
      {
        title: "Heavy rainfall in Kirtipur",
        categoryName: "Weather & Environment",
        severity: "advice",
        shortDescription:
          "Continuous rainfall flooded low-lying roads in Kirtipur.",
        latitude: 27.6675,
        longitude: 85.278,
        createdAt: new Date("2025-10-01T16:00:00Z"),
      },
      {
        title: "Small landslide in Sundarijal",
        categoryName: "Weather & Environment",
        severity: "watchAndAct",
        shortDescription:
          "Road blocked due to small landslide near Sundarijal hiking trail.",
        latitude: 27.7892,
        longitude: 85.4253,
        createdAt: new Date("2025-10-01T16:30:00Z"),
      },
      {
        title: "Bridge collapse in Gorkha",
        categoryName: "Infrastructure & Services",
        severity: "emergency",
        shortDescription:
          "A suspension bridge collapsed due to rust and overuse.",
        latitude: 28.0135,
        longitude: 84.6339,
        createdAt: new Date("2025-10-01T17:00:00Z"),
      },
      {
        title: "Robbery reported in New Road",
        categoryName: "Safety & Security",
        severity: "info",
        shortDescription: "Two individuals reported being robbed at New Road.",
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
          shortDescription: hazardData.shortDescription,
          categoryId: category.id,
          latitude: hazardData.latitude,
          longitude: hazardData.longitude,
          severity: hazardData.severity as HazardSeverity,
          source: "Fake Data Generator",
        },
        include: { category: true },
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
