// import type { AIPrompt } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { config } from "../utils/config.js";

// Type definition for AIPrompt (temporary until Prisma generates types)
export interface AIPrompt {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  variables: any; // JSON
  version: string;
  isActive: boolean;
  createdById: string;
  updatedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: any;
  updatedBy?: any;
}

// Cache for prompts to avoid database calls on every AI request
const promptCache = new Map<string, AIPrompt>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Supported prompt types for the application
 */
export enum PromptType {
  REVIEW_AND_SUMMARIZE = "review_and_summarize",
  SUMMARIZE = "summarize",
  SEVERITY_ASSESSMENT = "severity_assessment",
}

/**
 * Interface for prompt variables
 */
export interface PromptVariables {
  [key: string]: string;
}

/**
 * Interface for creating or updating prompts
 */
export interface CreatePromptData {
  name: string;
  description?: string;
  content: string;
  variables: string[];
  version?: string;
  isActive?: boolean;
}

export interface UpdatePromptData {
  description?: string;
  content?: string;
  variables?: string[];
  version?: string;
  isActive?: boolean;
}

/**
 * Initialize AI prompts in the database if they don't exist
 */
export const initializeAIPrompts = async (): Promise<void> => {
  try {
    const count = await prisma.aIPrompt.count();
    if (count > 0) {
      return;
    }

    // Find the super admin to use as creator
    const superAdmin = await prisma.admin.findUnique({
      where: { email: config.adminCredentials.superAdminEmail },
    });

    if (!superAdmin) {
      console.log("Super admin not found, skipping AI prompts initialization");
      return;
    }

    // Define the three prompts to create
    const defaultPrompts = [
      {
        name: PromptType.REVIEW_AND_SUMMARIZE,
        description:
          "Reviews and summarizes hazard reports to determine validity, severity, and clarity",
        content: "", // Empty content for now, will be filled later
        variables: [
          "title",
          "description",
          "locationname",
          "latitude",
          "longitude",
          "category",
        ],
        version: "1.0",
        isActive: true,
      },
      {
        name: PromptType.SUMMARIZE,
        description:
          "Summarizes hazard reports to generate standardized titles, descriptions, and categorization",
        content: "", // Empty content for now, will be filled later
        variables: [
          "title",
          "description",
          "locationname",
          "latitude",
          "longitude",
          "categoriesinfo",
          "parentcategoriesinfo",
        ],
        version: "1.0",
        isActive: true,
      },
      {
        name: PromptType.SEVERITY_ASSESSMENT,
        description:
          "Determines hazard severity levels and appropriate call-to-action messages",
        content: "", // Empty content for now, will be filled later
        variables: [
          "title",
          "description",
          "locationname",
          "latitude",
          "longitude",
          "category",
          "severitykeywords",
          "allowedseveritylevels",
        ],
        version: "1.0",
        isActive: true,
      },
    ];

    // Check and create each prompt
    for (const promptData of defaultPrompts) {
      const existingPrompt = await prisma.aIPrompt.findFirst({
        where: { name: promptData.name },
      });

      if (!existingPrompt) {
        console.log(`Creating AI prompt: ${promptData.name}`);
        await prisma.aIPrompt.create({
          data: {
            ...promptData,
            createdById: superAdmin.id,
          },
        });
      } else {
        console.log(`AI prompt already exists: ${promptData.name}`);
      }
    }

    console.log("AI prompts initialization completed");
  } catch (error) {
    console.error("Error initializing AI prompts:", error);
    // Don't throw the error, just log it, as prompts are not critical for basic functionality
  }
};

/**
 * Retrieves an active AI prompt by name with caching
 */
export const getPromptByName = async (name: string): Promise<AIPrompt> => {
  // Check cache first
  const cached = promptCache.get(name);
  const cacheTime = cacheTimestamps.get(name);

  if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
    return cached;
  }

  // Fetch from database
  const prompt = (await prisma.aIPrompt.findFirst({
    where: {
      name,
      isActive: true,
    },
    orderBy: {
      version: "desc", // Get latest version
    },
  })) as AIPrompt | null;

  if (!prompt) {
    throw new HttpError(
      404,
      `AI prompt with name '${name}' not found or inactive`
    );
  }

  // Update cache
  promptCache.set(name, prompt);
  cacheTimestamps.set(name, Date.now());

  return prompt;
};

/**
 * Retrieves a formatted prompt with variables substituted
 */
export const getFormattedPrompt = async (
  name: string,
  variables: PromptVariables
): Promise<string> => {
  const prompt = await getPromptByName(name);

  // Validate that all required variables are provided
  const requiredVariables = prompt.variables as string[];
  const missingVariables = requiredVariables.filter(
    (variable) => !(variable in variables)
  );

  if (missingVariables.length > 0) {
    throw new HttpError(
      400,
      `Missing required variables for prompt '${name}': ${missingVariables.join(
        ", "
      )}`
    );
  }

  // Replace variables in the prompt content
  let formattedContent = prompt.content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    formattedContent = formattedContent.replace(regex, value);
  }

  return formattedContent;
};

/**
 * Retrieves a raw prompt content without variable substitution (for system messages)
 */
export const getRawPromptByName = async (name: string): Promise<string> => {
  const prompt = await getPromptByName(name);
  return prompt.content;
};

/**
 * Creates a new AI prompt (Admin only)
 */
export const createPrompt = async (
  promptData: CreatePromptData,
  adminId: string
): Promise<AIPrompt> => {
  // Check if prompt with same name already exists
  const existingPrompt = await prisma.aIPrompt.findFirst({
    where: { name: promptData.name },
  });

  if (existingPrompt) {
    throw new HttpError(
      409,
      `Prompt with name '${promptData.name}' already exists`
    );
  }

  const prompt = await prisma.aIPrompt.create({
    data: {
      name: promptData.name,
      ...(promptData.description && { description: promptData.description }),
      content: promptData.content,
      variables: promptData.variables,
      version: promptData.version || "1.0",
      ...(promptData.isActive && { isActive: promptData.isActive }),
      createdById: adminId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Clear cache to ensure fresh data
  clearCache();

  return prompt;
};

/**
 * Updates an existing AI prompt (Admin only)
 */
export const updatePrompt = async (
  promptId: string,
  promptData: UpdatePromptData,
  adminId: string
): Promise<AIPrompt> => {
  const existingPrompt = await prisma.aIPrompt.findUnique({
    where: { id: promptId },
  });

  if (!existingPrompt) {
    throw new HttpError(404, `Prompt with ID '${promptId}' not found`);
  }

  const updatedPrompt = await prisma.aIPrompt.update({
    where: { id: promptId },
    data: {
      ...promptData,
      updatedById: adminId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Clear cache to ensure fresh data
  clearCache();

  return updatedPrompt;
};

/**
 * Retrieves all AI prompts.
 */
export const getAllPrompts = async (
  page: number = 1,
  pageSize: number = 20,
  includeInactive: boolean = false
): Promise<AIPrompt[]> => {
  const where = includeInactive ? {} : { isActive: true };

  const prompts = prisma.aIPrompt.findMany({
    where,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return prompts;
};

/**
 * Retrieves a single AI prompt by ID (Admin only)
 */
export const getPromptById = async (promptId: string): Promise<AIPrompt> => {
  const prompt = await prisma.aIPrompt.findUnique({
    where: { id: promptId },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!prompt) {
    throw new HttpError(404, `Prompt with ID '${promptId}' not found`);
  }

  return prompt;
};

/**
 * Deactivates an AI prompt (Admin only)
 */
export const deactivatePrompt = async (
  promptId: string,
  adminId: string
): Promise<AIPrompt> => {
  const prompt = await updatePrompt(promptId, { isActive: false }, adminId);
  return prompt;
};

/**
 * Activates an AI prompt (Admin only)
 */
export const activatePrompt = async (
  promptId: string,
  adminId: string
): Promise<AIPrompt> => {
  const prompt = await updatePrompt(promptId, { isActive: true }, adminId);
  return prompt;
};

/**
 * Deletes an AI prompt permanently (Admin only)
 * NOTE: This is a hard delete and should be used with caution
 */
export const deletePrompt = async (promptId: string): Promise<void> => {
  const existingPrompt = await prisma.aIPrompt.findUnique({
    where: { id: promptId },
  });

  if (!existingPrompt) {
    throw new HttpError(404, `Prompt with ID '${promptId}' not found`);
  }

  await prisma.aIPrompt.delete({
    where: { id: promptId },
  });

  // Clear cache to ensure fresh data
  clearCache();
};

/**
 * Validates prompt content by checking for required variable placeholders
 */
export const validatePromptContent = (
  content: string,
  variables: string[]
): { isValid: boolean; missingVariables: string[]; errors: string[] } => {
  const errors: string[] = [];
  const missingVariables: string[] = [];

  // Check if all declared variables are used in the content
  for (const variable of variables) {
    const regex = new RegExp(`{{${variable}}}`, "g");
    if (!regex.test(content)) {
      missingVariables.push(variable);
    }
  }

  // Check for variables used in content but not declared
  const usedVariables = content.match(/{{(\w+)}}/g);
  if (usedVariables) {
    const declaredVariableSet = new Set(variables);
    for (const usedVar of usedVariables) {
      const varName = usedVar.replace(/[{}]/g, "");
      if (!declaredVariableSet.has(varName)) {
        errors.push(
          `Variable '${varName}' is used in content but not declared in variables array`
        );
      }
    }
  }

  if (missingVariables.length > 0) {
    errors.push(
      `Variables declared but not used in content: ${missingVariables.join(
        ", "
      )}`
    );
  }

  return {
    isValid: errors.length === 0,
    missingVariables,
    errors,
  };
};

/**
 * Clears the prompt cache
 */
export const clearCache = (): void => {
  promptCache.clear();
  cacheTimestamps.clear();
};

/**
 * Gets cache statistics (Admin only)
 */
export const getCacheStats = (): {
  cacheSize: number;
  cachedPrompts: string[];
} => {
  return {
    cacheSize: promptCache.size,
    cachedPrompts: Array.from(promptCache.keys()),
  };
};
