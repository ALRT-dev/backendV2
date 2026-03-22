import type { NextFunction, Request, Response } from "express";
import type {
  GetCategoriesForAdminQuery,
  CreateHazardCategoryForAdminBody,
  UpdateHazardCategoryForAdminBody,
} from "../../validators/admin/hazard_category.validator.js";
import prisma from "../../utils/prisma_client.util.js";
import { HttpError } from "../../models/http_error.js";
import {
  uploadFileToS3,
  deleteFileFromS3,
  enrichCategoryImagesWithPresignedUrls,
} from "../../services/s3.service.js";
import {
  CATEGORY_IMAGE_FIELD_TO_TYPE,
  CATEGORY_IMAGE_FIELD_NAMES,
} from "../../constants/category_image.constants.js";
import type { CategoryImageType } from "@prisma/client";

export const getCategoriesForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {}: GetCategoriesForAdminQuery = req.query;

    const categories = await prisma.hazardCategory.findMany({
      where: {
        parentId: null,
      },
      include: {
        images: true,
        parent: true,
        subCategories: {
          include: {
            images: true,
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
        0,
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

    const enriched = await enrichCategoryImagesWithPresignedUrls(
      transformedCategories
    );
    res.status(200).json(enriched);
  } catch (error) {
    next(error);
  }
};

export const createHazardCategoryForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      id,
      name,
      description,
      color,
      keywords,
      isFireRelated,
      parentId,
      imageDimensions,
    }: CreateHazardCategoryForAdminBody = req.body;

    // If ID is provided, check if it already exists
    if (id) {
      const existingById = await prisma.hazardCategory.findUnique({
        where: { id },
      });
      if (existingById) {
        throw new HttpError(400, `Category with ID '${id}' already exists`);
      }
    }

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
        ...(id && { id }),
        name,
        ...(description && { description }),
        ...(color && { color }),
        ...(parentId && { parentId }),
        ...(keywords && { keywords }),
        ...(isFireRelated !== undefined && { isFireRelated }),
      },
      include: {
        parent: true,
        subCategories: true,
        images: true,
      },
    });

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (files) {
      const folder = `category-images/${createdCategory.id}`;
      for (const fieldName of CATEGORY_IMAGE_FIELD_NAMES) {
        const file = files[fieldName]?.[0];
        if (!file) continue;
        const imageType = CATEGORY_IMAGE_FIELD_TO_TYPE[fieldName] as CategoryImageType;
        const dims = imageDimensions?.[imageType];
        const result = await uploadFileToS3(file, folder);
        await prisma.hazardCategoryImage.create({
          data: {
            categoryId: createdCategory.id,
            imageType,
            s3Key: result.key,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            fileSizeBytes: result.size ?? null,
          },
        });
      }
      const withImages = await prisma.hazardCategory.findUnique({
        where: { id: createdCategory.id },
        include: { parent: true, subCategories: true, images: true },
      });
      const enriched = await enrichCategoryImagesWithPresignedUrls(
        withImages ? [withImages] : [createdCategory]
      );
      return res.status(201).json(enriched[0] ?? createdCategory);
    }

    res.status(201).json(createdCategory);
  } catch (error) {
    next(error);
  }
};

export const updateHazardCategoryForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
      keywords,
      isFireRelated,
      parentId,
      imageDimensions,
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
          targetId: string,
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
          parentId,
        );
        if (hasCircularDependency) {
          throw new HttpError(
            400,
            "Cannot create circular dependency in category hierarchy",
          );
        }
      }
    }

    const updatedCategory = await prisma.hazardCategory.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(parentId !== undefined && { parentId }),
        ...(keywords && { keywords }),
        ...(isFireRelated !== undefined && { isFireRelated }),
      },
      include: {
        parent: true,
        subCategories: true,
        images: true,
      },
    });

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const folder = `category-images/${categoryId}`;

    if (files) {
      for (const fieldName of CATEGORY_IMAGE_FIELD_NAMES) {
        const file = files[fieldName]?.[0];
        if (!file) continue;
        const imageType = CATEGORY_IMAGE_FIELD_TO_TYPE[fieldName] as CategoryImageType;
        const dims = imageDimensions?.[imageType];
        const existing = await prisma.hazardCategoryImage.findUnique({
          where: {
            categoryId_imageType: { categoryId: categoryId!, imageType },
          },
        });
        if (existing) {
          try {
            await deleteFileFromS3(existing.s3Key);
          } catch (e) {
            console.error("Error deleting old category image from S3:", e);
          }
        }
        const result = await uploadFileToS3(file, folder);
        await prisma.hazardCategoryImage.upsert({
          where: {
            categoryId_imageType: { categoryId: categoryId!, imageType },
          },
          create: {
            categoryId: categoryId!,
            imageType,
            s3Key: result.key,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            fileSizeBytes: result.size ?? null,
          },
          update: {
            s3Key: result.key,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            fileSizeBytes: result.size ?? null,
          },
        });
      }
    }

    if (imageDimensions && Object.keys(imageDimensions).length > 0) {
      for (const [imageType, dims] of Object.entries(imageDimensions)) {
        if (!dims || typeof dims.width !== "number" || typeof dims.height !== "number")
          continue;
        await prisma.hazardCategoryImage.updateMany({
          where: {
            categoryId: categoryId!,
            imageType: imageType as CategoryImageType,
          },
          data: { width: dims.width, height: dims.height },
        });
      }
    }

    const withImages = await prisma.hazardCategory.findUnique({
      where: { id: categoryId },
      include: { parent: true, subCategories: true, images: true },
    });
    const toReturn = withImages ?? updatedCategory;
    const enriched = await enrichCategoryImagesWithPresignedUrls([toReturn]);
    res.status(200).json(enriched[0] ?? toReturn);
  } catch (error) {
    next(error);
  }
};

export const deleteHazardCategoryForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const categoryImages = await prisma.hazardCategoryImage.findMany({
      where: { categoryId },
      select: { s3Key: true },
    });
    for (const img of categoryImages) {
      try {
        await deleteFileFromS3(img.s3Key);
      } catch (e) {
        console.error("Error deleting category image from S3:", e);
      }
    }

    // Check if category has any hazards associated with it
    if (existingCategory._count.hazards > 0) {
      throw new HttpError(
        400,
        "Cannot delete category that has associated hazards. Please reassign or delete the hazards first.",
      );
    }

    // Check if category has subcategories
    if (existingCategory.subCategories.length > 0) {
      throw new HttpError(
        400,
        "Cannot delete category that has subcategories. Please delete or reassign the subcategories first.",
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
