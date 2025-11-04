import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import {
  Prisma,
  type HazardCategory,
  type HazardReviewStatus,
  type HazardSeverity,
  type LocationSubscription,
} from "@prisma/client";

/**
 * Populate the database with a predefined set of hazard categories.
 * If a category already exists, it will not be duplicated.
 */
export const populateInitialCategories = async () => {
  try {
    const categories: Prisma.HazardCategoryCreateInput[] = [
      {
        id: "safetyAndSecurity",
        name: "Safety & Security",
        description: "Crime, Civil Unrest, Terror Threat",
        color: "#FC9493",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "crime" },
              create: {
                id: "crime",
                name: "Crime",
                description: "Criminal activities including theft and assault",
              },
            },
            {
              where: { id: "fight" },
              create: {
                id: "fight",
                name: "Fight",
                description: "Physical altercations and brawls",
              },
            },
            {
              where: { id: "shooting" },
              create: {
                id: "shooting",
                name: "Shooting",
                description: "Gun violence incidents",
              },
            },
            {
              where: { id: "terrorism" },
              create: {
                id: "terrorism",
                name: "Terrorism",
                description: "Terrorist activities and threats",
              },
            },
            {
              where: { id: "bombThreat" },
              create: {
                id: "bombThreat",
                name: "Bomb Threat",
                description: "Explosive device threats and incidents",
              },
            },
            {
              where: { id: "riot" },
              create: {
                id: "riot",
                name: "Riot",
                description: "Civil disorder and violent public disturbances",
              },
            },
            {
              where: { id: "policeLockdown" },
              create: {
                id: "policeLockdown",
                name: "Police Lockdown",
                description: "Law enforcement security measures",
              },
            },
          ],
        },
      },
      {
        id: "healthAndEmergency",
        name: "Health & Medical",
        description: "Health emergencies and medical incidents",
        color: "#FCC27B",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "diseaseOutbreak" },
              create: {
                id: "diseaseOutbreak",
                name: "Disease Outbreak",
                description: "Infectious disease outbreaks and epidemics",
              },
            },
            {
              where: { id: "medicalEmergency" },
              create: {
                id: "medicalEmergency",
                name: "Medical Emergency",
                description: "Serious medical situations requiring urgent care",
              },
            },
            {
              where: { id: "ambulanceResponse" },
              create: {
                id: "ambulanceResponse",
                name: "Ambulance Response",
                description: "Emergency medical services dispatched",
              },
            },
            {
              where: { id: "chemicalExposure" },
              create: {
                id: "chemicalExposure",
                name: "Chemical Exposure",
                description: "Exposure to hazardous chemicals",
              },
            },
            {
              where: { id: "foodPoisoning" },
              create: {
                id: "foodPoisoning",
                name: "Food Poisoning",
                description: "Foodborne illness incidents",
              },
            },
            {
              where: { id: "heatwaveSickness" },
              create: {
                id: "heatwaveSickness",
                name: "Heatwave Sickness",
                description: "Heat-related health emergencies",
              },
            },
            {
              where: { id: "massCasualtyEvent" },
              create: {
                id: "massCasualtyEvent",
                name: "Mass Casualty Event",
                description: "Large-scale emergency with multiple victims",
              },
            },
          ],
        },
      },
      {
        id: "weatherAndEnvironment",
        name: "Weather & Environment",
        description: "Weather and environmental hazards",
        color: "#97D7FA",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "bushfire" },
              create: {
                id: "bushfire",
                name: "Bushfire",
                description: "Wildfire and bushfire incidents",
              },
            },
            {
              where: { id: "cyclone" },
              create: {
                id: "cyclone",
                name: "Cyclone",
                description: "Severe weather hazards including cyclones",
              },
            },
            {
              where: { id: "storm" },
              create: {
                id: "storm",
                name: "Storm",
                description: "Active storm events including thunderstorms",
              },
            },
            {
              where: { id: "flood" },
              create: {
                id: "flood",
                name: "Flood",
                description: "Flooding and water-related emergencies",
              },
            },
            {
              where: { id: "extremeHeat" },
              create: {
                id: "extremeHeat",
                name: "Extreme Heat",
                description: "Extreme heat events and heatwaves",
              },
            },
            {
              where: { id: "damagingWinds" },
              create: {
                id: "damagingWinds",
                name: "Damaging Winds",
                description: "High wind events causing damage",
              },
            },
            {
              where: { id: "heavyRain" },
              create: {
                id: "heavyRain",
                name: "Heavy Rain",
                description: "Intense rainfall and precipitation",
              },
            },
            {
              where: { id: "smoke" },
              create: {
                id: "smoke",
                name: "Smoke",
                description: "Smoke from fires affecting air quality",
              },
            },
            {
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
              },
            },
            {
              where: { id: "landslide" },
              create: {
                id: "landslide",
                name: "Landslide",
                description: "Movement of rock, earth, or debris down a slope",
              },
            },
            {
              where: { id: "poorAirQuality" },
              create: {
                id: "poorAirQuality",
                name: "Poor Air Quality",
                description: "Air pollution and quality concerns",
              },
            },
          ],
        },
      },
      {
        id: "transportAndTravel",
        name: "Transport & Travel",
        description: "Transportation and travel disruptions",
        color: "#86DF9D",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "carCrash" },
              create: {
                id: "carCrash",
                name: "Car Crash",
                description: "Vehicle accidents and collisions",
              },
            },
            {
              where: { id: "trainDerailment" },
              create: {
                id: "trainDerailment",
                name: "Train Derailment",
                description: "Railway accidents and derailments",
              },
            },
            {
              where: { id: "roadClosure" },
              create: {
                id: "roadClosure",
                name: "Road Closure",
                description: "Road blocks and closures",
              },
            },
            {
              where: { id: "airportEmergency" },
              create: {
                id: "airportEmergency",
                name: "Airport Emergency",
                description: "Aviation emergencies and incidents",
              },
            },
            {
              where: { id: "ferryAccident" },
              create: {
                id: "ferryAccident",
                name: "Ferry Accident",
                description: "Marine transport accidents",
              },
            },
            {
              where: { id: "majorTrafficDelay" },
              create: {
                id: "majorTrafficDelay",
                name: "Major Traffic Delay",
                description: "Significant traffic congestion and delays",
              },
            },
          ],
        },
      },
      {
        id: "infrastructureAndServices",
        name: "Infrastructure & Services",
        description: "Infrastructure failures and service disruptions",
        color: "#FFE47A",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "structuralFire" },
              create: {
                id: "structuralFire",
                name: "Structural Fire",
                description: "Fires in buildings and structures",
              },
            },
            {
              where: { id: "powerOutage" },
              create: {
                id: "powerOutage",
                name: "Power Outage",
                description: "Electrical power failures and blackouts",
              },
            },
            {
              where: { id: "gasLeak" },
              create: {
                id: "gasLeak",
                name: "Gas Leak",
                description: "Natural gas leaks and related hazards",
              },
            },
            {
              where: { id: "internetDown" },
              create: {
                id: "internetDown",
                name: "Internet Down",
                description: "Internet and telecommunications outages",
              },
            },
            {
              where: { id: "waterContamination" },
              create: {
                id: "waterContamination",
                name: "Water Contamination",
                description: "Water supply contamination issues",
              },
            },
            {
              where: { id: "industrialFire" },
              create: {
                id: "industrialFire",
                name: "Industrial Fire",
                description: "Fires at industrial facilities",
              },
            },
            {
              where: { id: "hazmatSpill" },
              create: {
                id: "hazmatSpill",
                name: "Hazmat Spill",
                description: "Hazardous material spills and leaks",
              },
            },
          ],
        },
      },
      {
        id: "crowdsAndEvents",
        name: "Crowds & Events",
        description: "Large gatherings and crowd-related incidents",
        color: "#AB87F1",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "concertFestivalIncident" },
              create: {
                id: "concertFestivalIncident",
                name: "Concert/Festival Incident",
                description: "Incidents at concerts and festivals",
              },
            },
            {
              where: { id: "protest" },
              create: {
                id: "protest",
                name: "Protest",
                description: "Public demonstrations and protests",
              },
            },
            {
              where: { id: "largeSportingEvent" },
              create: {
                id: "largeSportingEvent",
                name: "Large Sporting Event",
                description: "Incidents at sporting venues and events",
              },
            },
            {
              where: { id: "crowdCrushStampede" },
              create: {
                id: "crowdCrushStampede",
                name: "Crowd Crush/Stampede",
                description: "Dangerous crowd movements and stampedes",
              },
            },
          ],
        },
      },
      {
        id: "other",
        name: "Other",
        description: "Miscellaneous Hazards Not Classified Elsewhere",
        color: "#BAA27D",
      },
    ];

    const createdCategories = [];

    for (const categoryData of categories) {
      if (categoryData.id) {
        // First, upsert the main category without subcategories
        const { subCategories, ...mainCategoryData } = categoryData;

        const upsertedCategory: HazardCategory & {
          subCategories?: HazardCategory[];
        } = await prisma.hazardCategory.upsert({
          where: { id: categoryData.id },
          update: mainCategoryData, // Update main category fields
          create: mainCategoryData, // Create main category fields only
        });

        // Then handle subcategories separately if they exist
        if (
          subCategories &&
          "connectOrCreate" in subCategories &&
          Array.isArray(subCategories.connectOrCreate)
        ) {
          for (const subCategoryData of subCategories.connectOrCreate) {
            const subCategoryId = subCategoryData.where.id;
            if (subCategoryId) {
              const upsertedSubCategory = await prisma.hazardCategory.upsert({
                where: { id: subCategoryId },
                update: {
                  ...subCategoryData.create,
                  parentId: upsertedCategory.id, // Ensure parent relationship
                },
                create: {
                  ...subCategoryData.create,
                  parentId: upsertedCategory.id, // Ensure parent relationship
                },
              });

              upsertedCategory.subCategories =
                upsertedCategory.subCategories || [];
              upsertedCategory.subCategories?.push(upsertedSubCategory);
            }
          }
        }

        createdCategories.push(upsertedCategory);
      }
    }

    console.log(
      `------------------------------------> Populated ${createdCategories.length} hazard categories.`
    );

    return createdCategories;
  } catch (error) {
    console.error("Error populating hazard categories:", error);
    throw error;
  }
};

/**
 * Get all sub-categories from the database.
 */
export const getAllSubHazardCategories = async () => {
  const subCategories = await prisma.hazardCategory.findMany({
    where: {
      parentId: { not: null },
    },
  });
  return subCategories;
};

/**
 * Get categories applying the specified filters.
 */
export const getCategoriesApplyingFilters = async ({
  hazardSearchString,
  hazardSeverities,
  hazardReviewStatus,
  hazardReportedById,
  hazardNortheastLat,
  hazardNortheastLng,
  hazardSouthwestLat,
  hazardSouthwestLng,
  showExpiredHazards,
  subscriptions,
}: {
  hazardSearchString?: string | undefined;
  hazardSeverities?: HazardSeverity[] | undefined;
  hazardReviewStatus?: HazardReviewStatus | undefined;
  hazardReportedById?: string | undefined;
  hazardNortheastLat?: number | undefined;
  hazardNortheastLng?: number | undefined;
  hazardSouthwestLat?: number | undefined;
  hazardSouthwestLng?: number | undefined;
  showExpiredHazards?: boolean | undefined;
  subscriptions?: LocationSubscription[] | undefined;
}) => {
  const hazardsWhereClause = buildHazardsWhereClause({
    searchString: hazardSearchString,
    severities: hazardSeverities,
    reviewStatus: hazardReviewStatus,
    reportedById: hazardReportedById,
    northeastLat: hazardNortheastLat,
    northeastLng: hazardNortheastLng,
    southwestLat: hazardSouthwestLat,
    southwestLng: hazardSouthwestLng,
    showExpired: showExpiredHazards,
    subscriptions,
  });

  const categories = await prisma.hazardCategory.findMany({
    where: {
      parentId: null, // Only parent categories
      OR: [
        { hazards: { some: hazardsWhereClause } }, // Parent category has hazards
        { subCategories: { some: { hazards: { some: hazardsWhereClause } } } }, // Subcategories have hazards
      ],
    },
    include: {
      _count: {
        select: {
          hazards: {
            where: hazardsWhereClause,
          },
        },
      },
      subCategories: {
        include: {
          _count: {
            select: {
              hazards: {
                where: hazardsWhereClause,
              },
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const transformedCategories = categories
    .map((category) => {
      // Calculate total hazards count (parent + all subcategories)
      const parentHazardsCount = category._count.hazards;
      const subCategoriesHazardsCount = category.subCategories.reduce(
        (total, subCategory) => total + subCategory._count.hazards,
        0
      );
      const totalHazardsCount = parentHazardsCount + subCategoriesHazardsCount;

      return {
        ...category,
        hazardsCount: totalHazardsCount,
        _count: undefined,
        subCategories: undefined, // Remove subcategories from response to keep it clean
      };
    })
    .filter((category) => category.hazardsCount > 0) // Only return categories with hazards
    .sort((a, b) => b.hazardsCount - a.hazardsCount); // Sort by hazards count descending

  return transformedCategories;
};
