import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  HazardReviewStatus,
  HazardSeverity,
  LocationSubscription,
  Prisma,
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
        subCategories: {
          create: [
            {
              id: "crime",
              name: "Crime",
              description: "Criminal activities including theft and assault",
            },
            {
              id: "fight",
              name: "Fight",
              description: "Physical altercations and brawls",
            },
            {
              id: "shooting",
              name: "Shooting",
              description: "Gun violence incidents",
            },
            {
              id: "terrorism",
              name: "Terrorism",
              description: "Terrorist activities and threats",
            },
            {
              id: "bombThreat",
              name: "Bomb Threat",
              description: "Explosive device threats and incidents",
            },
            {
              id: "riot",
              name: "Riot",
              description: "Civil disorder and violent public disturbances",
            },
            {
              id: "policeLockdown",
              name: "Police Lockdown",
              description: "Law enforcement security measures",
            },
          ],
        },
      },
      {
        id: "healthAndEmergency",
        name: "Health & Medical",
        description: "Health emergencies and medical incidents",
        subCategories: {
          create: [
            {
              id: "diseaseOutbreak",
              name: "Disease Outbreak",
              description: "Infectious disease outbreaks and epidemics",
            },
            {
              id: "medicalEmergency",
              name: "Medical Emergency",
              description: "Serious medical situations requiring urgent care",
            },
            {
              id: "ambulanceResponse",
              name: "Ambulance Response",
              description: "Emergency medical services dispatched",
            },
            {
              id: "chemicalExposure",
              name: "Chemical Exposure",
              description: "Exposure to hazardous chemicals",
            },
            {
              id: "foodPoisoning",
              name: "Food Poisoning",
              description: "Foodborne illness incidents",
            },
            {
              id: "heatwaveSickness",
              name: "Heatwave Sickness",
              description: "Heat-related health emergencies",
            },
            {
              id: "massCasualtyEvent",
              name: "Mass Casualty Event",
              description: "Large-scale emergency with multiple victims",
            },
          ],
        },
      },
      {
        id: "weatherAndEnvironment",
        name: "Weather & Environment",
        description: "Weather and environmental hazards",
        subCategories: {
          create: [
            {
              id: "bushfire",
              name: "Bushfire",
              description: "Wildfire and bushfire incidents",
            },
            {
              id: "cyclone",
              name: "Cyclone",
              description: "Severe weather hazards including cyclones",
            },
            {
              id: "storm",
              name: "Storm",
              description: "Active storm events including thunderstorms",
            },

            {
              id: "flood",
              name: "Flood",
              description: "Flooding and water-related emergencies",
            },
            {
              id: "extremeHeat",
              name: "Extreme Heat",
              description: "Extreme heat events and heatwaves",
            },
            {
              id: "tornado",
              name: "Tornado",
              description: "Tornado and severe wind events",
            },
            {
              id: "heavyRain",
              name: "Heavy Rain",
              description: "Intense rainfall and precipitation",
            },
            {
              id: "smoke",
              name: "Smoke",
              description: "Smoke from fires affecting air quality",
            },
            {
              id: "poorAirQuality",
              name: "Poor Air Quality",
              description: "Air pollution and quality concerns",
            },
          ],
        },
      },
      {
        id: "transportAndTravel",
        name: "Transport & Travel",
        description: "Transportation and travel disruptions",
        subCategories: {
          create: [
            {
              id: "carCrash",
              name: "Car Crash",
              description: "Vehicle accidents and collisions",
            },
            {
              id: "trainDerailment",
              name: "Train Derailment",
              description: "Railway accidents and derailments",
            },
            {
              id: "roadClosure",
              name: "Road Closure",
              description: "Road blocks and closures",
            },
            {
              id: "airportEmergency",
              name: "Airport Emergency",
              description: "Aviation emergencies and incidents",
            },
            {
              id: "ferryAccident",
              name: "Ferry Accident",
              description: "Marine transport accidents",
            },
            {
              id: "majorTrafficDelay",
              name: "Major Traffic Delay",
              description: "Significant traffic congestion and delays",
            },
          ],
        },
      },
      {
        id: "infrastructureAndServices",
        name: "Infrastructure & Services",
        description: "Infrastructure failures and service disruptions",
        subCategories: {
          create: [
            {
              id: "powerOutage",
              name: "Power Outage",
              description: "Electrical power failures and blackouts",
            },
            {
              id: "gasLeak",
              name: "Gas Leak",
              description: "Natural gas leaks and related hazards",
            },
            {
              id: "internetDown",
              name: "Internet Down",
              description: "Internet and telecommunications outages",
            },
            {
              id: "waterContamination",
              name: "Water Contamination",
              description: "Water supply contamination issues",
            },
            {
              id: "industrialFire",
              name: "Industrial Fire",
              description: "Fires at industrial facilities",
            },
            {
              id: "hazmatSpill",
              name: "Hazmat Spill",
              description: "Hazardous material spills and leaks",
            },
          ],
        },
      },
      {
        id: "crowdsAndEvents",
        name: "Crowds & Events",
        description: "Large gatherings and crowd-related incidents",
        subCategories: {
          create: [
            {
              id: "concertFestivalIncident",
              name: "Concert/Festival Incident",
              description: "Incidents at concerts and festivals",
            },
            {
              id: "protest",
              name: "Protest",
              description: "Public demonstrations and protests",
            },
            {
              id: "largeSportingEvent",
              name: "Large Sporting Event",
              description: "Incidents at sporting venues and events",
            },
            {
              id: "crowdCrushStampede",
              name: "Crowd Crush/Stampede",
              description: "Dangerous crowd movements and stampedes",
            },
          ],
        },
      },
      {
        id: "other",
        name: "Other",
        description: "Miscellaneous Hazards Not Classified Elsewhere",
      },
    ];

    const createdCategories = [];

    for (const categoryData of categories) {
      const existingCategory = await prisma.hazardCategory.findUnique({
        where: { id: categoryData.id! },
      });
      if (existingCategory) {
        console.log(`Category ${categoryData.name} already exists. Skipping.`);
        continue; // Skip creation if category already exists
      }

      const createdCategory = await prisma.hazardCategory.create({
        data: categoryData,
      });

      createdCategories.push(createdCategory);
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
export const getAllSubCategories = async () => {
  const subCategories = await prisma.hazardCategory.findMany({
    where: {
      parentId: { not: null },
    },
  });
  return subCategories;
};

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
      hazards: { some: hazardsWhereClause },
    },
    include: {
      _count: {
        select: {
          hazards: {
            where: hazardsWhereClause,
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

  const transformedCategories = categories.map((category) => ({
    ...category,
    hazardsCount: category._count.hazards,
    _count: undefined,
  }));

  return transformedCategories;
};
