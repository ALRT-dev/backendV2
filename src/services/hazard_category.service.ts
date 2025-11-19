import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  HazardCategory,
  HazardReviewStatus,
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
                keywords: [
                  "road rescue",
                  "vehicle rescue",
                  "car rescue",
                  "truck rescue",
                ],
              },
            },
            {
              where: { id: "rescueMarine" },
              create: {
                id: "rescueMarine",
                name: "Rescue (Marine)",
                description:
                  "Rescue operations for trapped individuals in water",
                keywords: [
                  "marine rescue",
                  "water rescue",
                  "boat rescue",
                  "ship rescue",
                ],
              },
            },
            {
              where: { id: "crime" },
              create: {
                id: "crime",
                name: "Crime",
                description: "Criminal activities including theft and assault",
                keywords: [
                  "crime",
                  "theft",
                  "burglary",
                  "assault",
                  "robbery",
                  "vandalism",
                  "break and enter",
                  "carjacking",
                  "armed robbery",
                  "domestic violence",
                  "sexual assault",
                ],
              },
            },
            {
              where: { id: "terror" },
              create: {
                id: "terror",
                name: "Terror",
                description: "Terror threats and incidents",
                keywords: [
                  "terror",
                  "terrorism",
                  "police operations",
                  "security operations",
                  "escape hide tell",
                  "national security",
                  "suspicious persons",
                  "knife fight",
                  "investigation",
                  "active threat",
                ],
              },
            },
            {
              where: { id: "hazardousItem" },
              create: {
                id: "hazardousItem",
                name: "Hazardous Item",
                description: "Reports of hazardous items",
                keywords: [
                  "hazardous item",
                  "dangerous item",
                  "suspicious package",
                  "explosive device",
                  "bomb squad response",
                ],
              },
            },
            {
              where: { id: "missingPerson" },
              create: {
                id: "missingPerson",
                name: "Missing Person",
                description: "Reports of missing individuals",
                keywords: ["missing person", "lost person"],
              },
            },
          ],
        },
      },
      {
        id: "healthAndEmergency",
        name: "Health & Medical",
        description: "Health emergencies and medical incidents",
        keywords: [
          "medical emergency",
          "health emergency",
          "ambulance needed",
          "paramedic response",
        ],
        color: "#FCC27B",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "ambulanceResponse" },
              create: {
                id: "ambulanceResponse",
                name: "Ambulance Response",
                description: "Emergency medical services dispatched",
                keywords: ["ambulance response"],
              },
            },
          ],
        },
      },
      {
        id: "weatherAndEnvironment",
        name: "Weather & Environment",
        description: "Weather and environmental hazards",
        keywords: ["marine wind"],
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
                  "bushfire",
                  "wild fire",
                  "wildfire",
                  "grass",
                  "grass fire",
                  "grassfire",
                  "forest fire",
                  "forestfire",
                  "vegetation fire",
                  "vegetationfire",
                  "scrub fire",
                  "scrubfire",
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
                  "planned burn",
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
                keywords: ["fire alarm", "false alarm"],
              },
            },
            {
              where: { id: "cyclone" },
              create: {
                id: "cyclone",
                name: "Cyclone",
                description: "Severe weather hazards including cyclones",
                keywords: [
                  "cyclone",
                  "tropical cyclone watch",
                  "tropical cyclone warning",
                  "category 1–5 cyclone",
                ],
              },
            },
            {
              where: { id: "storm" },
              create: {
                id: "storm",
                name: "Storm",
                description: "Active storm events including thunderstorms",
                keywords: [
                  "storm",
                  "severe weather warning",
                  "severe thunderstorm warning",
                  "heavy rain",
                  "large hail",
                ],
              },
            },
            {
              where: { id: "flood" },
              create: {
                id: "flood",
                name: "Flood",
                description: "Flooding and water-related emergencies",
                keywords: [
                  "flood",
                  "flood watch",
                  "minor flood",
                  "moderate flood",
                  "major flood",
                  "flash flooding",
                  "riverine flood",
                  "dam flood warning",
                ],
              },
            },
            {
              where: { id: "extremeHeat" },
              create: {
                id: "extremeHeat",
                name: "Extreme Heat",
                description: "Extreme heat events and heatwaves",
                keywords: [
                  "extreme heat",
                  "extreme heatwave",
                  "extreme heatwave warning",
                  "heat health alert",
                  "extreme heat warning",
                ],
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
                keywords: [
                  "tsunami",
                  "tsunami watch",
                  "tsunami warning",
                  "marine warning",
                  "land inundation warning",
                ],
              },
            },
            {
              where: { id: "volcanicActivity" },
              create: {
                id: "volcanicActivity",
                name: "Volcanic Activity",
                description: "Volcanic eruptions and ash fall",
                keywords: ["volcanic activity"],
              },
            },
            {
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
                keywords: [
                  "earthquake",
                  "earthquake alert",
                  "significant earthquake notice",
                ],
              },
            },
            {
              where: { id: "landslide" },
              create: {
                id: "landslide",
                name: "Landslide",
                description: "Movement of rock, earth, or debris down a slope",
                keywords: [
                  "landslide",
                  "slope instability",
                  "landslip",
                  "rockfall",
                  "slope failure",
                ],
              },
            },
            {
              where: { id: "smoke" },
              create: {
                id: "smoke",
                name: "Smoke",
                description: "Smoke from fires affecting air quality",
                keywords: ["smoke"],
              },
            },
            {
              where: { id: "pollen" },
              create: {
                id: "pollen",
                name: "Pollen",
                description: "Pollen from plants affecting air quality",
                keywords: [
                  "pollen",
                  "high pollen count",
                  "allergy alert",
                  "hay fever",
                ],
              },
            },
            {
              where: { id: "uvIndex" },
              create: {
                id: "uvIndex",
                name: "UV Index",
                description: "Ultraviolet index and related health warnings",
                keywords: [
                  "uv index",
                  "ultraviolet index",
                  "uv warning",
                  "uv alert",
                ],
              },
            },
            {
              where: { id: "poorAirQuality" },
              create: {
                id: "poorAirQuality",
                name: "Poor Air Quality",
                description: "Air pollution and quality concerns",
                keywords: [
                  "poor air quality",
                  "air quality alert",
                  "air pollution",
                  "smog",
                  "haze",
                  "air quality health alert",
                  "hazardous smoke",
                  "high pollution day",
                ],
              },
            },
            {
              where: { id: "treeDown" },
              create: {
                id: "treeDown",
                name: "Tree Down",
                description: "Fallen trees causing hazards",
                keywords: [
                  "tree down",
                  "fallen tree",
                  "tree blocking road",
                  "tree blocking path",
                ],
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
                keywords: [
                  "car crash",
                  "crash",
                  "vehicle accident",
                  "mva",
                  "serious crash",
                  "major traffic incident",
                  "multi-vehicle crash",
                ],
              },
            },
            {
              where: { id: "vehicleFire" },
              create: {
                id: "vehicleFire",
                name: "Vehicle Fire",
                description: "Fires involving vehicles",
                isFireRelated: true,
                keywords: [
                  "vehicle fire",
                  "car fire",
                  "truck fire",
                  "bus fire",
                  "motorcycle fire",
                ],
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
                keywords: [
                  "public transport crowding",
                  "bus crowding",
                  "train crowding",
                  "subway crowding",
                ],
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
                keywords: [
                  "venue evacuation",
                  "mall evacuation",
                  "stadium evacuation",
                  "theatre evacuation",
                ],
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
                keywords: ["water over road"],
              },
            },
            {
              where: { id: "roadWork" },
              create: {
                id: "roadWork",
                name: "Road Work",
                description: "Road construction and maintenance work",
                keywords: [
                  "road work",
                  "changed traffic conditions",
                  "road closure",
                  "road upgrade",
                  "road closed",
                  "local access only",
                  "bridge closed",
                  "landslip on road",
                ],
              },
            },
            {
              where: { id: "busBreakdown" },
              create: {
                id: "busBreakdown",
                name: "Bus Breakdown",
                description: "Bus breakdowns and service disruptions",
                keywords: [
                  "bus breakdown",
                  "bus out of service",
                  "bus stalled",
                ],
              },
            },
            {
              where: { id: "trafficSignalFailure" },
              create: {
                id: "trafficSignalFailure",
                name: "Traffic Signal Failure",
                description: "Failures of traffic signals and lights",
                keywords: [
                  "traffic signal failure",
                  "traffic light failure",
                  "signal outage",
                ],
              },
            },
            {
              where: { id: "roadDamage" },
              create: {
                id: "roadDamage",
                name: "Road Damage",
                description: "Damage to roads affecting travel",
                keywords: ["road damage", "pothole", "road hazard"],
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
                keywords: [
                  "structure fire",
                  "haystack fire",
                  "structure",
                  "building fire",
                  "house fire",
                  "unit fire",
                  "factory fire",
                  "high-rise fire",
                  "bin fire",
                  "dump fire",
                ],
              },
            },
            {
              where: { id: "chemicalSpill" },
              create: {
                id: "chemicalSpill",
                name: "Chemical Spill",
                description: "Spills of hazardous chemicals",
                keywords: [
                  "chemical spill",
                  "hazardous chemical spill",
                  "toxic spill",
                  "chemical leak",
                ],
              },
            },
            {
              where: { id: "hazmatSpill" },
              create: {
                id: "hazmatSpill",
                name: "Hazmat Spill",
                description: "Hazardous material spills and leaks",
                keywords: [
                  "hazmat spill",
                  "hazardous material spill",
                  "hazmat leak",
                ],
              },
            },
            {
              where: { id: "powerOutage" },
              create: {
                id: "powerOutage",
                name: "Power Outage",
                description: "Electrical power failures and blackouts",
                keywords: [
                  "power outage",
                  "blackout",
                  "electricity outage",
                  "power failure",
                  "wire down",
                  "unplanned power outage",
                  "planned power outage",
                  "load shedding",
                ],
              },
            },
            {
              where: { id: "waterIssue" },
              create: {
                id: "waterIssue",
                name: "Water Issue",
                description: "Water supply issues",
                keywords: [
                  "burst water main",
                  "water outage",
                  "low pressure",
                  "burst main",
                ],
              },
            },
            {
              where: { id: "gasLeak" },
              create: {
                id: "gasLeak",
                name: "Gas Leak",
                description: "Natural gas leaks and related hazards",
                keywords: [
                  "gas leak",
                  "gas odor",
                  "gas smell",
                  "gas outage",
                  "gas supply interruption",
                ],
              },
            },
          ],
        },
      },
      {
        id: "crowdsAndEvents",
        name: "Crowds & Events",
        description: "Large gatherings and crowd-related incidents",
        keywords: [
          "special event",
          "crowd gathering",
          "community event",
          "festival scheduled",
          "large crowd expected",
          "general event notification",
          "sporting match",
          "protest",
          "rally",
          "demonstration",
        ],
        color: "#AB87F1",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "concertFestival" },
              create: {
                id: "concertFestival",
                name: "Concert/Festival",
                description: "Incidents at concerts and festivals",
                keywords: [
                  "concert",
                  "festival",
                  "music festival",
                  "live music event",
                ],
              },
            },
            {
              where: { id: "protest" },
              create: {
                id: "protest",
                name: "Protest",
                description: "Public demonstrations and protests",
                keywords: [
                  "protest",
                  "demonstration",
                  "rally",
                  "public gathering",
                  "mass gathering",
                ],
              },
            },
            {
              where: { id: "largeSportingEvent" },
              create: {
                id: "largeSportingEvent",
                name: "Large Sporting Event",
                description: "Incidents at sporting venues and events",
                keywords: [
                  "large sporting event",
                  "sporting event",
                  "sports match",
                  "football match",
                  "soccer match",
                ],
              },
            },
          ],
        },
      },
      {
        id: "other",
        name: "Other",
        description: "Miscellaneous Hazards Not Classified Elsewhere",
        keywords: ["assist other agency"],
        color: "#BAA27D",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "algaeBloom" },
              create: {
                id: "algaeBloom",
                name: "Algae Bloom",
                description: "Harmful algal blooms in water bodies",
                keywords: [
                  "algae bloom",
                  "harmful algae bloom",
                  "red tide",
                  "blue-green algae",
                ],
              },
            },
            {
              where: { id: "electricalHazard" },
              create: {
                id: "electricalHazard",
                name: "Electrical Hazard",
                description: "Incidents involving electrical hazards",
                keywords: [
                  "electrical hazard",
                  "live wire",
                  "downed power line",
                  "electrocution risk",
                ],
              },
            },
            {
              where: { id: "sharkSighting" },
              create: {
                id: "sharkSighting",
                name: "Shark Sighting",
                description: "Reports of shark sightings in water bodies",
                keywords: [
                  "shark sighting",
                  "confirmed shark",
                  "beach closed due to shark",
                ],
              },
            },
            {
              where: { id: "evacuationCenter" },
              create: {
                id: "evacuationCenter",
                name: "Evacuation Center",
                description: "Designated evacuation centers during emergencies",
                keywords: [
                  "evacuation center",
                  "evacuate now",
                  "evacuation warning",
                  "evacuation centre open",
                ],
              },
            },
            {
              where: { id: "animalDisease" },
              create: {
                id: "animalDisease",
                name: "Animal Disease",
                description:
                  "Outbreaks of diseases affecting livestock or wildlife",
                keywords: [
                  "animal disease",
                  "livestock disease",
                  "wildlife disease",
                  "disease outbreak",
                  "avian flu",
                  "foot and mouth disease",
                  "biosecurity alert",
                ],
              },
            },
            {
              where: { id: "pestInvasion" },
              create: {
                id: "pestInvasion",
                name: "Pest Invasion",
                description:
                  "Reports of pest invasions affecting health or property",
                keywords: [
                  "pest invasion",
                  "rodent infestation",
                  "insect swarm",
                  "vermin outbreak",
                  "locust plague",
                  "invasive pest alert",
                ],
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
