import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import type { CreateHazardCategoryInput } from "../validators/hazard_category.validator.js";
import type { Prisma } from "@prisma/client";

export const getHazardCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await prisma.hazardCategory.findMany({
      include: {
        _count: {
          select: {
            hazards: true,
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

    res.status(200).json(transformedCategories);
  } catch (error) {
    next(error);
  }
};

export const createHazardCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description }: CreateHazardCategoryInput = req.body;

    const existingCategory = await prisma.hazardCategory.findUnique({
      where: { name },
    });
    if (existingCategory) {
      throw new HttpError(409, "Category with this name already exists");
    }

    const newCategory = await prisma.hazardCategory.create({
      data: { name, description: description || null },
    });

    res.status(201).json(newCategory);
  } catch (error) {
    next(error);
  }
};

export const populateCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
        continue; // Skip creation if category already exists
      }

      const createdCategory = await prisma.hazardCategory.create({
        data: categoryData,
      });

      createdCategories.push(createdCategory);
    }

    res.status(201).json(createdCategories);
  } catch (error) {
    next(error);
  }
};
