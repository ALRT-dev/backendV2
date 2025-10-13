import type { Prisma } from "@prisma/client";
import {
  parseBoMWarningsToHazards,
  parseGeoJsonToHazards,
} from "../utils/ingestion.util.js";
import crypto from "crypto";
import prisma from "../utils/prisma_client.util.js";

/**
 * Fetches hazard data from the NSW Rural Fire Service (RFS) feed
 * and converts it into an array of HazardCreateInput objects.
 */
export const getHazardsDataFromRFS = async () => {
  try {
    const response = await fetch(
      "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json"
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch RFS data: ${response.statusText}`);
    }

    const category = await prisma.hazardCategory.findFirst({
      where: { name: "Weather & Environment" },
    });
    if (!category) {
      throw new Error("Hazard category 'Weather & Environment' not found");
    }

    const data = await response.json();
    const hazards = parseGeoJsonToHazards(data, category.id);

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connectOrCreate: {
          where: {
            url: "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json",
          },
          create: {
            name: "NSW Rural Fire Service",
            url: "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json",
          },
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
export const getHazardsDataFromBoM = async () => {
  try {
    const response = await fetch(
      "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records?limit=20"
    );
    if (!response.ok) {
      console.error("Failed to fetch BoM data:", response.statusText);
      return [];
    }

    const data = await response.json();
    const hazards = parseBoMWarningsToHazards(
      data,
      "d28289d9-dc57-447f-a052-ec7fef27723d"
    );

    return hazards.map((hazard) => ({
      ...hazard,
      source: {
        connectOrCreate: {
          where: {
            url: "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records",
          },
          create: {
            name: "Bureau of Meteorology",
            url: "https://data.peclet.com.au/api/explore/v2.1/catalog/datasets/bom-national-warnings-summary/records",
          },
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
