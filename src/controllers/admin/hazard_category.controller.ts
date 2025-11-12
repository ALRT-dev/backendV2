import type { NextFunction, Request, Response } from "express";
import type {
  GetCategoriesForAdminQuery,
  CreateHazardCategoryForAdminBody,
  UpdateHazardCategoryForAdminBody,
} from "../../validators/admin/hazard_category.validator.js";
import prisma from "../../utils/prisma_client.util.js";
import { HttpError } from "../../models/http_error.js";

export const getCategoriesForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {}: GetCategoriesForAdminQuery = req.query;

    const categories = await prisma.hazardCategory.findMany({
      where: {
        parentId: null,
      },
      include: {
        parent: true,
        subCategories: {
          include: {
            _count: {
              select: {
                hazards: {
                  where: {
                    expiresAt: {
                      gt: new Date(),
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            hazards: {
              where: {
                expiresAt: {
                  gt: new Date(),
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const transformedCategories = categories.map((category) => {
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
        subCategories: category.subCategories.map((subCategory) => ({
          ...subCategory,
          hazardsCount: subCategory._count.hazards,
          color: subCategory.color || category.color,
          _count: undefined,
        })),
      };
    });

    res.status(200).json(transformedCategories);
  } catch (error) {
    next(error);
  }
};

export const createHazardCategoryForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      description,
      color,
      severityKeywords,
      callToActions,
      aiInstructions,
      parentId,
    }: CreateHazardCategoryForAdminBody = req.body;

    // Check if category with same name already exists
    const existingCategory = await prisma.hazardCategory.findUnique({
      where: { name },
    });
    if (existingCategory) {
      throw new HttpError(400, `Category with name '${name}' already exists`);
    }

    // If parentId is provided, verify the parent category exists
    if (parentId) {
      const parentCategory = await prisma.hazardCategory.findUnique({
        where: { id: parentId },
      });
      if (!parentCategory) {
        throw new HttpError(400, "Parent category not found");
      }
    }

    const createdCategory = await prisma.hazardCategory.create({
      data: {
        name,
        ...(description && { description }),
        ...(color && { color }),
        ...(severityKeywords && { severityKeywords }),
        ...(callToActions && { callToActions }),
        ...(aiInstructions && { aiInstructions }),
        ...(parentId && { parentId }),
      },
      include: {
        parent: true,
        subCategories: true,
      },
    });

    res.status(201).json(createdCategory);
  } catch (error) {
    next(error);
  }
};

export const updateHazardCategoryForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.categoryId;
    if (!categoryId) {
      throw new HttpError(400, "categoryId parameter is required");
    }

    const {
      name,
      description,
      color,
      severityKeywords,
      callToActions,
      aiInstructions,
      parentId,
    }: UpdateHazardCategoryForAdminBody = req.body;

    // Check if category exists
    const existingCategory = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
    });
    if (!existingCategory) {
      throw new HttpError(404, `Category with id ${categoryId} not found`);
    }

    // If name is being updated, check if it conflicts with existing categories
    if (name && name !== existingCategory.name) {
      const categoryWithSameName = await prisma.hazardCategory.findUnique({
        where: { name },
      });
      if (categoryWithSameName) {
        throw new HttpError(400, `Category with name '${name}' already exists`);
      }
    }

    // If parentId is being updated, verify the parent category exists
    if (parentId !== undefined) {
      if (parentId === categoryId) {
        throw new HttpError(400, "Category cannot be its own parent");
      }

      if (parentId) {
        const parentCategory = await prisma.hazardCategory.findUnique({
          where: { id: parentId },
        });
        if (!parentCategory) {
          throw new HttpError(400, "Parent category not found");
        }

        // Check for circular dependency by checking if the current category is already a parent/ancestor of the new parent
        const checkCircularDependency = async (
          checkId: string,
          targetId: string
        ): Promise<boolean> => {
          if (checkId === targetId) return true;

          const children = await prisma.hazardCategory.findMany({
            where: { parentId: checkId },
            select: { id: true },
          });

          for (const child of children) {
            if (await checkCircularDependency(child.id, targetId)) {
              return true;
            }
          }
          return false;
        };

        const hasCircularDependency = await checkCircularDependency(
          categoryId,
          parentId
        );
        if (hasCircularDependency) {
          throw new HttpError(
            400,
            "Cannot create circular dependency in category hierarchy"
          );
        }
      }
    }

    const updatedCategory = await prisma.hazardCategory.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(severityKeywords !== undefined && { severityKeywords }),
        ...(callToActions !== undefined && { callToActions }),
        ...(aiInstructions !== undefined && { aiInstructions }),
        ...(parentId !== undefined && { parentId }),
      },
      include: {
        parent: true,
        subCategories: true,
      },
    });

    res.status(200).json(updatedCategory);
  } catch (error) {
    next(error);
  }
};

export const deleteHazardCategoryForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.categoryId;
    if (!categoryId) {
      throw new HttpError(400, "categoryId parameter is required");
    }

    // Check if category exists
    const existingCategory = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
      include: {
        subCategories: true,
        _count: {
          select: {
            hazards: true,
          },
        },
      },
    });

    if (!existingCategory) {
      throw new HttpError(404, `Category with id ${categoryId} not found`);
    }

    // Check if category has any hazards associated with it
    if (existingCategory._count.hazards > 0) {
      throw new HttpError(
        400,
        "Cannot delete category that has associated hazards. Please reassign or delete the hazards first."
      );
    }

    // Check if category has subcategories
    if (existingCategory.subCategories.length > 0) {
      throw new HttpError(
        400,
        "Cannot delete category that has subcategories. Please delete or reassign the subcategories first."
      );
    }

    await prisma.hazardCategory.delete({
      where: { id: categoryId },
    });

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
};
