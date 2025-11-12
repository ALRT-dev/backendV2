import type { NextFunction, Request, Response } from "express";
import type { GetCategoriesForAdminQuery } from "../../validators/admin/hazard_category.validator.js";
import prisma from "../../utils/prisma_client.util.js";

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
