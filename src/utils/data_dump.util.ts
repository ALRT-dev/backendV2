import fs from "fs/promises";
import path from "path";
import prisma from "./prisma_client.util.js";

/**
 * Creates a JSON dump of all hazards with their related data
 * @param filename - Optional filename for the dump file (defaults to timestamped filename)
 * @returns Promise resolving to the file path where the dump was saved
 */
export const dumpHazardsToJson = async (
  hazards: any[],
  filename?: string
): Promise<string> => {
  try {
    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = filename || `hazards_dump_${timestamp}.json`;

    // Ensure dumps directory exists
    const dumpsDir = path.join(process.cwd(), "dumps");
    await fs.mkdir(dumpsDir, { recursive: true });

    // Create full file path
    const filePath = path.join(dumpsDir, fileName);

    // Create the dump object with metadata
    const dumpData = {
      metadata: {
        dumpDate: new Date().toISOString(),
        totalRecords: hazards.length,
        version: "1.0.0",
      },
      hazards,
    };

    // Write to file
    await fs.writeFile(filePath, JSON.stringify(dumpData, null, 2), "utf8");

    console.log(`Hazards dump created successfully: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("Error creating hazards dump:", error);
    throw error;
  }
};

/* Appends a hazard to an existing dump file */
export const appendHazardToDump = async (
  hazard: any,
  dumpFilePath: string
): Promise<void> => {
  try {
    // If dumpFilePath is just a filename, construct the full path to dumps directory
    const fullPath = dumpFilePath.includes(path.sep)
      ? dumpFilePath
      : path.join(process.cwd(), "dumps", dumpFilePath);

    // Read existing dump file
    let data = await fs.readFile(fullPath, "utf8");

    // Clean up the data to handle any trailing characters or formatting issues
    data = data.trim();

    // Remove any trailing non-JSON characters
    const lastBraceIndex = data.lastIndexOf("}");
    if (lastBraceIndex !== -1 && lastBraceIndex < data.length - 1) {
      data = data.substring(0, lastBraceIndex + 1);
    }

    let parsed = JSON.parse(data);
    if (!parsed) {
      parsed = {
        metadata: {
          dumpDate: new Date().toISOString(),
          version: "1.0.0",
        },
        hazards: [],
      };
    }

    // Append new hazard
    parsed.hazards.push(hazard);
    parsed.metadata.totalRecords = parsed.hazards.length;

    // Write back to file
    await fs.writeFile(fullPath, JSON.stringify(parsed, null, 2), "utf8");

    console.log(`Hazard appended successfully to dump: ${fullPath}`);
  } catch (error) {
    console.error("Error appending hazard to dump:", error);
    throw error;
  }
};

/**
 * Creates a filtered JSON dump of hazards based on provided criteria
 * @param filters - Filter criteria for hazards
 * @param filename - Optional filename for the dump file
 * @returns Promise resolving to the file path where the dump was saved
 */
export const dumpFilteredHazardsToJson = async (
  filters: {
    categoryIds?: string[];
    searchString?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: string[];
    visibility?: boolean;
  },
  filename?: string
): Promise<string> => {
  try {
    // Build where clause for filtering
    const whereClause: any = {};

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      whereClause.categoryId = { in: filters.categoryIds };
    }

    if (filters.searchString) {
      whereClause.OR = [
        { title: { contains: filters.searchString, mode: "insensitive" } },
        {
          description: { contains: filters.searchString, mode: "insensitive" },
        },
        {
          shortDescription: {
            contains: filters.searchString,
            mode: "insensitive",
          },
        },
      ];
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = filters.endDate;
      }
    }

    if (filters.severity && filters.severity.length > 0) {
      whereClause.severity = { in: filters.severity };
    }

    if (filters.visibility !== undefined) {
      whereClause.visibility = filters.visibility;
    }

    // Fetch filtered hazards
    const hazards = await prisma.hazard.findMany({
      where: whereClause,
      include: {
        category: true,
        reportedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        source: true,
        votes: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = filename || `filtered_hazards_dump_${timestamp}.json`;

    // Ensure dumps directory exists
    const dumpsDir = path.join(process.cwd(), "dumps");
    await fs.mkdir(dumpsDir, { recursive: true });

    // Create full file path
    const filePath = path.join(dumpsDir, fileName);

    // Create the dump object with metadata
    const dumpData = {
      metadata: {
        dumpDate: new Date().toISOString(),
        totalRecords: hazards.length,
        filters: filters,
        version: "1.0.0",
      },
      hazards,
    };

    // Write to file
    await fs.writeFile(filePath, JSON.stringify(dumpData, null, 2), "utf8");

    console.log(`Filtered hazards dump created successfully: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("Error creating filtered hazards dump:", error);
    throw error;
  }
};

/**
 * Lists all dump files in the dumps directory
 * @returns Promise resolving to an array of dump file information
 */
export const listDumpFiles = async (): Promise<
  Array<{ filename: string; size: number; createdAt: Date }>
> => {
  try {
    const dumpsDir = path.join(process.cwd(), "dumps");

    // Check if dumps directory exists
    try {
      await fs.access(dumpsDir);
    } catch {
      return []; // Directory doesn't exist, return empty array
    }

    const files = await fs.readdir(dumpsDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    const fileInfos = await Promise.all(
      jsonFiles.map(async (filename) => {
        const filePath = path.join(dumpsDir, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      })
    );

    // Sort by creation date, newest first
    return fileInfos.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  } catch (error) {
    console.error("Error listing dump files:", error);
    throw error;
  }
};

/** Retrieves a specific hazard by ID from a dump file
 * @param dumpFilePath - Path to the dump JSON file (filename or full path)
 * @param hazardId - ID of the hazard to retrieve
 * @returns Promise resolving to the hazard object or null if not found
 */
export const getDumpHazardById = async (
  hazardId: string,
  dumpFilePath: string
): Promise<any | null> => {
  try {
    // If dumpFilePath is just a filename, construct the full path to dumps directory
    const fullPath = dumpFilePath.includes(path.sep)
      ? dumpFilePath
      : path.join(process.cwd(), "dumps", dumpFilePath);

    let data = await fs.readFile(fullPath, "utf8");

    // Clean up the data to handle any trailing characters or formatting issues
    data = data.trim();

    // Remove any trailing non-JSON characters (like % that might be added by shell)
    const lastBraceIndex = data.lastIndexOf("}");
    if (lastBraceIndex !== -1 && lastBraceIndex < data.length - 1) {
      data = data.substring(0, lastBraceIndex + 1);
    }

    const parsed = JSON.parse(data);
    if (!parsed || !parsed.hazards) return null;
    const hazard = parsed.hazards.find((h: any) => h.id === hazardId);
    return hazard || null;
  } catch (error) {
    console.error("Error reading dump file or finding hazard:", error);
    throw error;
  }
};
