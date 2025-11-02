import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import type { CreateHazardCategoryInput } from "../validators/hazard_category.validator.js";

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
