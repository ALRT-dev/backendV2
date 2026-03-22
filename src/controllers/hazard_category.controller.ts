import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import type { CreateHazardCategoryInput } from "../validators/hazard_category.validator.js";
import { populateInitialCategories } from "../services/hazard_category.service.js";
import { enrichCategoryImagesWithPresignedUrls } from "../services/s3.service.js";

/**
 * Get all categories including parent and sub categories.
 */
export const getAllHazardCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await prisma.hazardCategory.findMany({
      include: {
        parent: true,
        subCategories: { include: { images: true } },
        images: true,
      },
    });
    const enriched = await enrichCategoryImagesWithPresignedUrls(categories);
    res.status(200).json(enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all parent categories only.
 */
export const getAllParentHazardCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await prisma.hazardCategory.findMany({
      where: {
        parentId: null,
      },
      include: {
        subCategories: { include: { images: true } },
        images: true,
      },
    });
    const enriched = await enrichCategoryImagesWithPresignedUrls(categories);
    res.status(200).json(enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all sub categories only
 */
export const getAllSubHazardCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const subCategories = await prisma.hazardCategory.findMany({
      where: {
        parentId: { not: null },
      },
      include: {
        parent: true,
        images: true,
      },
    });
    const enriched = await enrichCategoryImagesWithPresignedUrls(subCategories);
    res.status(200).json(enriched);
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

export const deleteAllHazardCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deletedHazards = await prisma.hazard.deleteMany({});
    const deletedCategories = await prisma.hazardCategory.deleteMany({});
    res.status(200).json({
      message: "All hazard categories deleted",
      deletedCategoriesCount: deletedCategories.count,
      deletedHazardsCount: deletedHazards.count,
    });
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
