import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import type { CreateHazardCategoryInput } from "../validators/hazard_category.validator.js";
import { populateInitialCategories } from "../services/hazard_category.service.js";

export const getHazardCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await prisma.hazardCategory.findMany({
      where: {
        parentId: null,
      },
    });

    res.status(200).json(categories);
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
    const { name, description, parentId }: CreateHazardCategoryInput = req.body;

    const existingCategory = await prisma.hazardCategory.findUnique({
      where: { name },
    });
    if (existingCategory) {
      throw new HttpError(409, "Category with this name already exists");
    }

    const newCategory = await prisma.hazardCategory.create({
      data: {
        name,
        description: description || null,
        parentId: parentId || null,
      },
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
    const createdCategories = await populateInitialCategories();
    res.status(201).json(createdCategories);
  } catch (error) {
    next(error);
  }
};
