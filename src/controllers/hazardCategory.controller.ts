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
    const { name, emoji }: CreateHazardCategoryInput = req.body;

    const existingCategory = await prisma.hazardCategory.findUnique({
      where: { name },
    });
    if (existingCategory) {
      throw new HttpError(409, "Category with this name already exists");
    }

    const newCategory = await prisma.hazardCategory.create({
      data: { name, emoji: emoji || null },
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
    const categories = [
      { name: "Safety & Security", emoji: "🔒" },
      { name: "Traffic & Transport", emoji: "🚗" },
      { name: "Weather & Environment", emoji: "🌧️" },
      { name: "Health & Emergency", emoji: "🚑" },
      { name: "Infrastructure & Services", emoji: "🏗️" },
    ];

    const categoriesData: Prisma.HazardCategoryCreateInput[] = categories.map(
      (category) => ({
        name: category.name,
        emoji: category.emoji,
      })
    );

    const createdCategories = [];

    for (const categoryData of categoriesData) {
      const existingCategory = await prisma.hazardCategory.findUnique({
        where: { name: categoryData.name },
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
