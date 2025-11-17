import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  HazardCategory,
  HazardReviewStatus,
  HazardSeverity,
  LocationSubscription,
  Prisma,
} from "@prisma/client";
import type { HazardSeverityWithAwsCompliant } from "../models/hazard_search_params_interface.js";

/**
 * Check if any hazard categories exist in the database
 */
export const hasExistingCategories = async (): Promise<boolean> => {
  try {
    const count = await prisma.hazardCategory.count();
    return count > 0;
  } catch (error) {
    console.error("Error checking existing categories:", error);
    return false;
  }
};

/**
 * Initialize hazard categories if none exist
 * This function should be called when the server starts
 */
export const initializeHazardCategories = async (): Promise<void> => {
  try {
    const categoriesExist = await hasExistingCategories();

    if (!categoriesExist) {
      await populateInitialCategories();
      console.log(
        "---------------------------------------> Hazard categories initialized successfully"
      );
    }
  } catch (error) {
    console.error("❌ Error initializing hazard categories:", error);
    throw error;
  }
};

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
        keywords: [],
        color: "#FC9493",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "rescueRoad" },
              create: {
                id: "rescueRoad",
                name: "Rescue (Road)",
                description:
                  "Rescue operations for trapped individuals on roads",
                keywords: [],
              },
            },
            {
              where: { id: "rescueMarine" },
              create: {
                id: "rescueMarine",
                name: "Rescue (Marine)",
                description:
                  "Rescue operations for trapped individuals in water",
                keywords: [],
              },
            },
            {
              where: { id: "crime" },
              create: {
                id: "crime",
                name: "Crime",
                description: "Criminal activities including theft and assault",
                keywords: [],
              },
            },
            {
              where: { id: "terror" },
              create: {
                id: "terror",
                name: "Terror",
                description: "Terror threats and incidents",
                keywords: [],
              },
            },
            {
              where: { id: "missingPerson" },
              create: {
                id: "missingPerson",
                name: "Missing Person",
                description: "Reports of missing individuals",
                keywords: [],
              },
            },
          ],
        },
      },
      {
        id: "healthAndEmergency",
        name: "Health & Medical",
        description: "Health emergencies and medical incidents",
        keywords: [],
        color: "#FCC27B",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "ambulanceResponse" },
              create: {
                id: "ambulanceResponse",
                name: "Ambulance Response",
                description: "Emergency medical services dispatched",
                keywords: [],
              },
            },
          ],
        },
      },
      {
        id: "weatherAndEnvironment",
        name: "Weather & Environment",
        description: "Weather and environmental hazards",
        keywords: [],
        color: "#97D7FA",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "bushfire" },
              create: {
                id: "bushfire",
                name: "Bushfire",
                description: "Wildfire and bushfire incidents",
                isFireRelated: true,
                keywords: [
                  "bush fire",
                  "wild fire",
                  "grass fire",
                  "forest fire",
                  "vegetation fire",
                ],
              },
            },
            {
              where: { id: "plannedBurn" },
              create: {
                id: "plannedBurn",
                name: "Planned Burn",
                description: "Controlled burns for land management",
                isFireRelated: true,
                keywords: [
                  "hazard reduction",
                  "controlled burn",
                  "prescribed burn",
                  "burn off",
                  "planned event",
                ],
              },
            },
            {
              where: { id: "otherFire" },
              create: {
                id: "otherFire",
                name: "Other Fire",
                description: "Unclassified fire incidents",
                isFireRelated: true,
                keywords: ["fire alarm"],
              },
            },
            {
              where: { id: "cyclone" },
              create: {
                id: "cyclone",
                name: "Cyclone",
                description: "Severe weather hazards including cyclones",
                keywords: [],
              },
            },
            {
              where: { id: "storm" },
              create: {
                id: "storm",
                name: "Storm",
                description: "Active storm events including thunderstorms",
                keywords: [],
              },
            },
            {
              where: { id: "flood" },
              create: {
                id: "flood",
                name: "Flood",
                description: "Flooding and water-related emergencies",
                keywords: [],
              },
            },
            {
              where: { id: "extremeHeat" },
              create: {
                id: "extremeHeat",
                name: "Extreme Heat",
                description: "Extreme heat events and heatwaves",
                keywords: [],
              },
            },
            {
              where: { id: "damagingWinds" },
              create: {
                id: "damagingWinds",
                name: "Damaging Winds",
                description: "High wind events causing damage",
                keywords: [],
              },
            },
            {
              where: { id: "strongWinds" },
              create: {
                id: "strongWinds",
                name: "Strong Winds",
                description: "High wind events causing damage",
                keywords: [],
              },
            },
            {
              where: { id: "snow" },
              create: {
                id: "snow",
                name: "Snow",
                description: "Snowfall and winter weather conditions",
                keywords: [],
              },
            },
            {
              where: { id: "tsunami" },
              create: {
                id: "tsunami",
                name: "Tsunami",
                description: "Tsunami events and warnings",
                keywords: [],
              },
            },
            {
              where: { id: "volcanicActivity" },
              create: {
                id: "volcanicActivity",
                name: "Volcanic Activity",
                description: "Volcanic eruptions and ash fall",
                keywords: [],
              },
            },
            {
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
                keywords: [],
              },
            },
            {
              where: { id: "landslide" },
              create: {
                id: "landslide",
                name: "Landslide",
                description: "Movement of rock, earth, or debris down a slope",
                keywords: ["landslide", "slope instability"],
              },
            },
            {
              where: { id: "smoke" },
              create: {
                id: "smoke",
                name: "Smoke",
                description: "Smoke from fires affecting air quality",
                keywords: [],
              },
            },
            {
              where: { id: "pollen" },
              create: {
                id: "pollen",
                name: "Pollen",
                description: "Pollen from plants affecting air quality",
                keywords: [],
              },
            },
            {
              where: { id: "poorAirQuality" },
              create: {
                id: "poorAirQuality",
                name: "Poor Air Quality",
                description: "Air pollution and quality concerns",
                keywords: [],
              },
            },
            {
              where: { id: "treeDown" },
              create: {
                id: "treeDown",
                name: "Tree Down",
                description: "Fallen trees causing hazards",
                keywords: [],
              },
            },
          ],
        },
      },
      {
        id: "transportAndTravel",
        name: "Transport & Travel",
        description: "Transportation and travel disruptions",
        keywords: [],
        color: "#86DF9D",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "carCrash" },
              create: {
                id: "carCrash",
                name: "Car Crash",
                description: "Vehicle accidents and collisions",
                keywords: ["crash"],
              },
            },
            {
              where: { id: "vehicleFire" },
              create: {
                id: "vehicleFire",
                name: "Vehicle Fire",
                description: "Fires involving vehicles",
                isFireRelated: true,
                keywords: [],
              },
            },
            {
              where: {
                id: "publicTransportCrowding",
              },
              create: {
                id: "publicTransportCrowding",
                name: "Public Transport Crowding",
                description: "Crowding on public transport",
                keywords: [],
              },
            },
            {
              where: {
                id: "venueEvacuation",
              },
              create: {
                id: "venueEvacuation",
                name: "Venue Evacuation",
                description: "Evacuation of public venues",
                keywords: [],
              },
            },
            {
              where: {
                id: "waterOverRoad",
              },
              create: {
                id: "waterOverRoad",
                name: "Water Over Road",
                description: "Flooded roads and water hazards",
                keywords: ["Water over road"],
              },
            },
            {
              where: { id: "roadWork" },
              create: {
                id: "roadWork",
                name: "Road Work",
                description: "Road construction and maintenance work",
                keywords: [
                  "changed traffic conditions",
                  "road closure",
                  "road upgrade",
                ],
              },
            },
            {
              where: { id: "busBreakdown" },
              create: {
                id: "busBreakdown",
                name: "Bus Breakdown",
                description: "Bus breakdowns and service disruptions",
                keywords: [],
              },
            },
            {
              where: { id: "trafficSignalFailure" },
              create: {
                id: "trafficSignalFailure",
                name: "Traffic Signal Failure",
                description: "Failures of traffic signals and lights",
                keywords: [],
              },
            },
            {
              where: { id: "roadDamage" },
              create: {
                id: "roadDamage",
                name: "Road Damage",
                description: "Damage to roads affecting travel",
                keywords: ["road damage"],
              },
            },
          ],
        },
      },
      {
        id: "infrastructureAndServices",
        name: "Infrastructure & Services",
        description: "Infrastructure failures and service disruptions",
        keywords: [],
        color: "#FFE47A",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "structuralFire" },
              create: {
                id: "structuralFire",
                name: "Structural Fire",
                description: "Fires in buildings and structures",
                isFireRelated: true,
                keywords: ["structure fire", "haystack fire"],
              },
            },
            {
              where: { id: "chemicalSpill" },
              create: {
                id: "chemicalSpill",
                name: "Chemical Spill",
                description: "Spills of hazardous chemicals",
                keywords: [],
              },
            },
            {
              where: { id: "hazmatSpill" },
              create: {
                id: "hazmatSpill",
                name: "Hazmat Spill",
                description: "Hazardous material spills and leaks",
                keywords: [],
              },
            },
            {
              where: { id: "powerOutage" },
              create: {
                id: "powerOutage",
                name: "Power Outage",
                description: "Electrical power failures and blackouts",
                keywords: [],
              },
            },
            {
              where: { id: "waterIssue" },
              create: {
                id: "waterIssue",
                name: "Water Issue",
                description: "Water supply issues",
                keywords: [],
              },
            },
            {
              where: { id: "gasLeak" },
              create: {
                id: "gasLeak",
                name: "Gas Leak",
                description: "Natural gas leaks and related hazards",
                keywords: [],
              },
            },
          ],
        },
      },
      {
        id: "crowdsAndEvents",
        name: "Crowds & Events",
        description: "Large gatherings and crowd-related incidents",
        keywords: ["special event"],
        color: "#AB87F1",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "concertFestival" },
              create: {
                id: "concertFestival",
                name: "Concert/Festival",
                description: "Incidents at concerts and festivals",
                keywords: [],
              },
            },
            {
              where: { id: "protest" },
              create: {
                id: "protest",
                name: "Protest",
                description: "Public demonstrations and protests",
                keywords: [],
              },
            },
            {
              where: { id: "largeSportingEvent" },
              create: {
                id: "largeSportingEvent",
                name: "Large Sporting Event",
                description: "Incidents at sporting venues and events",
                keywords: [],
              },
            },
          ],
        },
      },
      {
        id: "other",
        name: "Other",
        description: "Miscellaneous Hazards Not Classified Elsewhere",
        keywords: [],
        color: "#BAA27D",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "algaeBloom" },
              create: {
                id: "algaeBloom",
                name: "Algae Bloom",
                description: "Harmful algal blooms in water bodies",
                keywords: [],
              },
            },
            {
              where: { id: "electricalHazard" },
              create: {
                id: "electricalHazard",
                name: "Electrical Hazard",
                description: "Incidents involving electrical hazards",
                keywords: [],
              },
            },
            {
              where: { id: "sharkSighting" },
              create: {
                id: "sharkSighting",
                name: "Shark Sighting",
                description: "Reports of shark sightings in water bodies",
                keywords: [],
              },
            },
            {
              where: { id: "evacuationCenter" },
              create: {
                id: "evacuationCenter",
                name: "Evacuation Center",
                description: "Designated evacuation centers during emergencies",
                keywords: [],
              },
            },
          ],
        },
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

    return createdCategories;
  } catch (error) {
    console.error("Error populating hazard categories:", error);
    throw error;
  }
};

/**
 * Force populate initial categories regardless of existing data
 * This function can be called manually if you want to reset or update categories
 */
export const forcePopulateCategories = async (): Promise<void> => {
  try {
    console.log("🔄 Force populating hazard categories...");
    await populateInitialCategories();
    console.log("✅ Categories force-populated successfully");
  } catch (error) {
    console.error("❌ Error force-populating categories:", error);
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
    include: {
      parent: true,
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
  hazardSeverities?: HazardSeverityWithAwsCompliant | undefined;
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
    severityFilter: hazardSeverities,
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
