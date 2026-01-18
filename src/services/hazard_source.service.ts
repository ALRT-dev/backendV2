import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import type { Prisma, HazardSource, HazardSourceLicense } from "@prisma/client";

/**
 * Interface for search parameters
 */
export interface GetHazardSourcesParams {
  page?: number;
  pageSize?: number;
  searchString?: string;
}

/**
 * Interface for creating a hazard source
 */
export interface CreateHazardSourceData {
  id?: string | undefined;
  name: string;
  url: string;
  imageUrl?: string | undefined;
  licenseId?: string | undefined;
  advisoryText?: string | undefined;
  copyrightText?: string | undefined;
  copyrightLink?: string | undefined;
}

/**
 * Interface for updating a hazard source
 */
export interface UpdateHazardSourceData {
  name?: string | undefined;
  url?: string | undefined;
  imageUrl?: string | null | undefined;
  licenseId?: string | null | undefined;
  advisoryText?: string | null | undefined;
  copyrightText?: string | null | undefined;
  copyrightLink?: string | null | undefined;
}

/**
 * Interface for creating a hazard source license
 */
export interface CreateHazardSourceLicenseData {
  badgeText: string;
  licenseText: string;
  description?: string | undefined;
  link?: string | undefined;
  foregroundColor?: string | undefined;
  backgroundColor?: string | undefined;
}

/**
 * Interface for updating a hazard source license
 */
export interface UpdateHazardSourceLicenseData {
  badgeText?: string | undefined;
  licenseText?: string | undefined;
  description?: string | null | undefined;
  link?: string | null | undefined;
  foregroundColor?: string | null | undefined;
  backgroundColor?: string | null | undefined;
}

/**
 * Get hazard sources with pagination and search
 */
export const getHazardSources = async (params: GetHazardSourcesParams) => {
  const { page = 1, pageSize = 20, searchString } = params;

  const sources = await prisma.hazardSource.findMany({
    where: searchString
      ? {
          OR: [
            { name: { contains: searchString, mode: "insensitive" } },
            { url: { contains: searchString, mode: "insensitive" } },
            { id: { contains: searchString, mode: "insensitive" } },
          ],
        }
      : {},
    include: {
      license: true,
      _count: {
        select: {
          hazards: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return sources.map((source) => ({
    ...source,
    hazardsCount: source._count.hazards,
    _count: undefined,
  }));
};

/**
 * Get a single hazard source by ID
 */
export const getHazardSourceById = async (sourceId: string) => {
  const source = await prisma.hazardSource.findUnique({
    where: { id: sourceId },
    include: {
      license: true,
      _count: {
        select: {
          hazards: true,
        },
      },
    },
  });

  if (!source) {
    throw new HttpError(404, "Hazard source not found");
  }

  return {
    ...source,
    hazardsCount: source._count.hazards,
    _count: undefined,
  };
};

/**
 * Create a new hazard source
 */
export const createHazardSource = async (data: CreateHazardSourceData) => {
  // If ID is provided, check if it already exists
  if (data.id) {
    const existingSourceById = await prisma.hazardSource.findUnique({
      where: { id: data.id },
    });

    if (existingSourceById) {
      throw new HttpError(400, "A hazard source with this ID already exists");
    }
  }

  // If licenseId is provided, verify it exists
  if (data.licenseId) {
    const license = await prisma.hazardSourceLicense.findUnique({
      where: { id: data.licenseId },
    });

    if (!license) {
      throw new HttpError(404, "License not found");
    }
  }

  const source = await prisma.hazardSource.create({
    data: {
      ...(data.id && { id: data.id }),
      name: data.name,
      url: data.url,
      ...(data.imageUrl && { imageUrl: data.imageUrl }),
      ...(data.licenseId && { licenseId: data.licenseId }),
      ...(data.advisoryText && { advisoryText: data.advisoryText }),
      ...(data.copyrightText && { copyrightText: data.copyrightText }),
      ...(data.copyrightLink && { copyrightLink: data.copyrightLink }),
    },
    include: {
      license: true,
      _count: {
        select: {
          hazards: true,
        },
      },
    },
  });

  return {
    ...source,
    hazardsCount: source._count.hazards,
    _count: undefined,
  };
};

/**
 * Update a hazard source
 */
export const updateHazardSource = async (
  sourceId: string,
  data: UpdateHazardSourceData,
) => {
  // Check if source exists
  const existingSource = await prisma.hazardSource.findUnique({
    where: { id: sourceId },
  });

  if (!existingSource) {
    throw new HttpError(404, "Hazard source not found");
  }

  // If licenseId is provided, verify it exists
  if (data.licenseId) {
    const license = await prisma.hazardSourceLicense.findUnique({
      where: { id: data.licenseId },
    });

    if (!license) {
      throw new HttpError(404, "License not found");
    }
  }

  const source = await prisma.hazardSource.update({
    where: { id: sourceId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.url && { url: data.url }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.licenseId !== undefined && { licenseId: data.licenseId }),
      ...(data.advisoryText !== undefined && {
        advisoryText: data.advisoryText,
      }),
      ...(data.copyrightText !== undefined && {
        copyrightText: data.copyrightText,
      }),
      ...(data.copyrightLink !== undefined && {
        copyrightLink: data.copyrightLink,
      }),
    },
    include: {
      license: true,
      _count: {
        select: {
          hazards: true,
        },
      },
    },
  });

  return {
    ...source,
    hazardsCount: source._count.hazards,
    _count: undefined,
  };
};

/**
 * Delete a hazard source
 */
export const deleteHazardSource = async (sourceId: string) => {
  // Check if source exists
  const existingSource = await prisma.hazardSource.findUnique({
    where: { id: sourceId },
  });

  if (!existingSource) {
    throw new HttpError(404, "Hazard source not found");
  }

  // Check if there are hazards associated with this source
  const hazardsCount = await prisma.hazard.count({
    where: { sourceId: sourceId },
  });

  if (hazardsCount > 0) {
    throw new HttpError(
      400,
      `Cannot delete hazard source with ${hazardsCount} associated hazards. Please delete or reassign the hazards first.`,
    );
  }

  await prisma.hazardSource.delete({
    where: { id: sourceId },
  });

  return { message: "Hazard source deleted successfully" };
};

/**
 * Get all hazard source licenses
 */
export const getHazardSourceLicenses = async (): Promise<
  HazardSourceLicense[]
> => {
  return prisma.hazardSourceLicense.findMany({
    orderBy: {
      badgeText: "asc",
    },
  });
};

/**
 * Check if a hazard source exists by ID
 */
export const hazardSourceExists = async (
  sourceId: string,
): Promise<boolean> => {
  const count = await prisma.hazardSource.count({
    where: { id: sourceId },
  });
  return count > 0;
};

/**
 * Check if a hazard source URL is already taken
 */
export const isUrlTaken = async (
  url: string,
  excludeSourceId?: string,
): Promise<boolean> => {
  const source = await prisma.hazardSource.findUnique({
    where: { url },
  });

  if (!source) return false;
  if (excludeSourceId && source.id === excludeSourceId) return false;
  return true;
};

/**
 * Get a single hazard source license by ID
 */
export const getHazardSourceLicenseById = async (
  licenseId: string,
): Promise<HazardSourceLicense> => {
  const license = await prisma.hazardSourceLicense.findUnique({
    where: { id: licenseId },
    include: {
      _count: {
        select: {
          hazardSources: true,
        },
      },
    },
  });

  if (!license) {
    throw new HttpError(404, "License not found");
  }

  return {
    ...license,
    sourcesCount: license._count.hazardSources,
    _count: undefined,
  } as any;
};

/**
 * Create a new hazard source license
 */
export const createHazardSourceLicense = async (
  data: CreateHazardSourceLicenseData,
): Promise<HazardSourceLicense> => {
  // Check if badge text already exists
  const existingLicense = await prisma.hazardSourceLicense.findUnique({
    where: { badgeText: data.badgeText },
  });

  if (existingLicense) {
    throw new HttpError(400, "A license with this badge text already exists");
  }

  const license = await prisma.hazardSourceLicense.create({
    data: {
      badgeText: data.badgeText,
      licenseText: data.licenseText,
      ...(data.description && { description: data.description }),
      ...(data.link && { link: data.link }),
      ...(data.foregroundColor && { foregroundColor: data.foregroundColor }),
      ...(data.backgroundColor && { backgroundColor: data.backgroundColor }),
    },
    include: {
      _count: {
        select: {
          hazardSources: true,
        },
      },
    },
  });

  return {
    ...license,
    sourcesCount: license._count.hazardSources,
    _count: undefined,
  } as any;
};

/**
 * Update a hazard source license
 */
export const updateHazardSourceLicense = async (
  licenseId: string,
  data: UpdateHazardSourceLicenseData,
): Promise<HazardSourceLicense> => {
  // Check if license exists
  const existingLicense = await prisma.hazardSourceLicense.findUnique({
    where: { id: licenseId },
  });

  if (!existingLicense) {
    throw new HttpError(404, "License not found");
  }

  // If badge text is being updated, check if it conflicts with another license
  if (data.badgeText && data.badgeText !== existingLicense.badgeText) {
    const existingLicenseByBadge = await prisma.hazardSourceLicense.findUnique({
      where: { badgeText: data.badgeText },
    });

    if (existingLicenseByBadge) {
      throw new HttpError(400, "A license with this badge text already exists");
    }
  }

  const license = await prisma.hazardSourceLicense.update({
    where: { id: licenseId },
    data: {
      ...(data.badgeText && { badgeText: data.badgeText }),
      ...(data.licenseText && { licenseText: data.licenseText }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.link !== undefined && { link: data.link }),
      ...(data.foregroundColor !== undefined && {
        foregroundColor: data.foregroundColor,
      }),
      ...(data.backgroundColor !== undefined && {
        backgroundColor: data.backgroundColor,
      }),
    },
  });

  // Get sources count separately
  const sourcesCount = await prisma.hazardSource.count({
    where: { licenseId: licenseId },
  });

  return {
    ...license,
    sourcesCount,
  } as any;
};

/**
 * Delete a hazard source license
 */
export const deleteHazardSourceLicense = async (
  licenseId: string,
): Promise<{ message: string }> => {
  // Check if license exists
  const existingLicense = await prisma.hazardSourceLicense.findUnique({
    where: { id: licenseId },
  });

  if (!existingLicense) {
    throw new HttpError(404, "License not found");
  }

  // Check if there are sources associated with this license
  const sourcesCount = await prisma.hazardSource.count({
    where: { licenseId: licenseId },
  });

  if (sourcesCount > 0) {
    throw new HttpError(
      400,
      `Cannot delete license with ${sourcesCount} associated sources. Please reassign the sources first.`,
    );
  }

  await prisma.hazardSourceLicense.delete({
    where: { id: licenseId },
  });

  return { message: "License deleted successfully" };
};
