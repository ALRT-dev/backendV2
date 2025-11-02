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
      },
      {
        id: "healthAndEmergency",
        name: "Health & Emergency",
        description: "Outbreaks, Mass Casualty Incidents",
      },
      {
        id: "weatherAndEnvironment",
        name: "Weather & Environment",
        description: "Storms, Flood, Fire, Smoke",
      },
      {
        id: "transportAndTravel",
        name: "Transport & Travel",
        description: "Road, Transport Disruptions",
      },
      {
        id: "infrastructureAndServices",
        name: "Infrastructure & Services",
        description: "Power, Communications, Hazmat",
      },
      {
        id: "crowdsAndEvents",
        name: "Crowds & Events",
        description: "Festivals, Protests, Large Groups",
      },
      {
        id: "bushfire",
        name: "Bushfire",
        description: "Wildfires, Forest Fires, Grass Fires",
      },
      {
        id: "coastalHazard",
        name: "Coastal Hazard",
        description: "Tsunami, Coastal Flooding, Storm Surge",
      },
      {
        id: "cyclone",
        name: "Cyclone",
        description: "Tropical Cyclones, Hurricanes, Typhoons",
      },
      {
        id: "damagingWinds",
        name: "Damaging Winds",
        description: "Derecho, Straight-line Winds, Downbursts",
      },
      {
        id: "earthquake",
        name: "Earthquake",
        description: "Seismic Activity, Tremors, Aftershocks",
      },
      {
        id: "flood",
        name: "Flood",
        description: "Riverine Flooding, Flash Flooding, Urban Flooding",
      },
      {
        id: "hazmat",
        name: "Hazmat",
        description:
          "Chemical Spills, Radiological Incidents, Biological Hazards",
      },
      {
        id: "heatwave",
        name: "Heatwave",
        description: "Extreme Heat Events, Prolonged High Temperatures",
      },
      {
        id: "humanPandemic",
        name: "Human Pandemic",
        description: "Widespread Infectious Diseases, Global Health Crises",
      },
      {
        id: "smoke",
        name: "Smoke",
        description: "Air Quality Issues, Smoke from Fires, Pollution Events",
      },
      {
        id: "storm",
        name: "Storm",
        description: "Severe Thunderstorms, Hailstorms, Tornadoes",
      },
      {
        id: "structuralFire",
        name: "Structural Fire",
        description: "Building Fires, Residential and Commercial Fires",
      },
      {
        id: "tsunami",
        name: "Tsunami",
        description: "Seismic Sea Waves, Coastal Inundation Events",
      },
      {
        id: "powerOutage",
        name: "Power Outage",
        description: "Electrical Failures, Blackouts, Grid Disruptions",
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
