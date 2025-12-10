// import type { AIPrompt } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { config } from "../utils/config.js";
import { HazardSeverityBand, type AIPrompt, type Prisma } from "@prisma/client";
import {
  getAirQualityAlertCategoryPrompt,
  getExtractLocationPrompt,
  getOfficialAlertReviewAndSummarizationPrompt,
  getSmartravellerSourcePrompt,
  getUserReportedAlertReviewAndSummarizationPrompt,
} from "../utils/ai-prompt.util.js";

// Cache for prompts to avoid database calls on every AI request
const promptCache = new Map<string, AIPrompt>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

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
  model: string;
}

export interface UpdatePromptData {
  description?: string;
  content?: string;
  variables?: string[];
  model?: string;
}

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
  const prompt = await prisma.aIPrompt.findFirst({
    where: { name },
  });

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
 * Retrieves all AI prompts.
 */
export const getAllPrompts = async (): Promise<AIPrompt[]> => {
  const prompts = prisma.aIPrompt.findMany({
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
    orderBy: [{ name: "asc" }],
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
      ...promptData,
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
 * Default AI Prompt Names
 * Used during initialization to create default prompts if they do not already exist
 */
export enum DefaultAIPromptNames {
  userReportedAlertReviewAndSummarizationInfo = "[INFO] User Reported Alert Review and Summarization",
  userReportedAlertReviewAndSummarizationMonitor = "[MONITOR] User Reported Alert Review and Summarization",
  userReportedAlertReviewAndSummarizationAction = "[ACTION] User Reported Alert Review and Summarization",
  userReportedAlertReviewAndSummarizationCritical = "[CRITICAL ]User Reported Alert Review and Summarization",

  officialAlertSummarizationInfo = "[INFO] Official Alert Summarization",
  officialAlertSummarizationMonitor = "[MONITOR] Official Alert Summarization",
  officialAlertSummarizationAction = "[ACTION] Official Alert Summarization",
  officialAlertSummarizationCritical = "[CRITICAL ] Official Alert Summarization",

  officialAwsAlertSummarizationInfo = "[INFO] Official AWS Alert Summarization",
  officialAwsAlertSummarizationMonitor = "[MONITOR] Official AWS Alert Summarization",
  officialAwsAlertSummarizationAction = "[ACTION] Official AWS Alert Summarization",
  officialAwsAlertSummarizationCritical = "[CRITICAL ] Official AWS Alert Summarization",

  airQualityAlertCategoryInfo = "[INFO] Air Quality Alert Category Summarization",
  airQualityAlertCategoryMonitor = "[MONITOR] Air Quality Alert Category Summarization",
  airQualityAlertCategoryAction = "[ACTION] Air Quality Alert Category Summarization",
  airQualityAlertCategoryCritical = "[CRITICAL ] Air Quality Alert Category Summarization",

  smartravellerSourceInfo = "[INFO] Smartraveller Source Alert Summarization",
  smartravellerSourceMonitor = "[MONITOR] Smartraveller Source Alert Summarization",
  smartravellerSourceAction = "[ACTION] Smartraveller Source Alert Summarization",
  smartravellerSourceCritical = "[CRITICAL ] Smartraveller Source Alert Summarization",

  extractLocationPrompt = "Extract Location from Text",
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

    const userReportedAlertReviewAndSummarizationPrompt =
      getUserReportedAlertReviewAndSummarizationPrompt();

    const officialAlertSummarizationPrompt =
      getOfficialAlertReviewAndSummarizationPrompt();

    const extractLocationPrompt = getExtractLocationPrompt();

    // Define the three prompts to create
    const defaultPrompts: Prisma.AIPromptCreateInput[] = [
      // User Reported Alert Review and Summarization Prompts
      {
        name: DefaultAIPromptNames.userReportedAlertReviewAndSummarizationInfo,
        description:
          "Used to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.",
        content: userReportedAlertReviewAndSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.userReportedAlertReviewAndSummarizationMonitor,
        description:
          "Used to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.",
        content: userReportedAlertReviewAndSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.userReportedAlertReviewAndSummarizationAction,
        description:
          "Used to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.",
        content: userReportedAlertReviewAndSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.userReportedAlertReviewAndSummarizationCritical,
        description:
          "Used to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.",
        content: userReportedAlertReviewAndSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },

      // Official Alert Summarization Prompts
      {
        name: DefaultAIPromptNames.officialAlertSummarizationInfo,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAlertSummarizationMonitor,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAlertSummarizationAction,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAlertSummarizationCritical,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },

      // Official AWS Alert Summarization Prompts
      {
        name: DefaultAIPromptNames.officialAwsAlertSummarizationInfo,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAwsAlertSummarizationMonitor,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAwsAlertSummarizationAction,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAwsAlertSummarizationCritical,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: officialAlertSummarizationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },

      // Air Quality Alert Category Prompts
      {
        name: DefaultAIPromptNames.airQualityAlertCategoryInfo,
        description:
          "Used to interpret incoming air quality alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getAirQualityAlertCategoryPrompt(HazardSeverityBand.info),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.airQualityAlertCategoryMonitor,
        description:
          "Used to interpret incoming air quality alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getAirQualityAlertCategoryPrompt(HazardSeverityBand.monitor),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.airQualityAlertCategoryAction,
        description:
          "Used to interpret incoming air quality alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getAirQualityAlertCategoryPrompt(HazardSeverityBand.action),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.airQualityAlertCategoryCritical,
        description:
          "Used to interpret incoming air quality alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getAirQualityAlertCategoryPrompt(HazardSeverityBand.critical),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },

      // Smartraveller Source Summarization Prompts
      {
        name: DefaultAIPromptNames.smartravellerSourceInfo,
        description:
          "Used to interpret incoming alerts from Smartraveller, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getSmartravellerSourcePrompt(HazardSeverityBand.info),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.smartravellerSourceMonitor,
        description:
          "Used to interpret incoming alerts from Smartraveller, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getSmartravellerSourcePrompt(HazardSeverityBand.monitor),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.smartravellerSourceAction,
        description:
          "Used to interpret incoming alerts from Smartraveller, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getSmartravellerSourcePrompt(HazardSeverityBand.action),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.smartravellerSourceCritical,
        description:
          "Used to interpret incoming alerts from Smartraveller, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: getSmartravellerSourcePrompt(HazardSeverityBand.critical),
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },

      // Extract Location Prompt
      {
        name: DefaultAIPromptNames.extractLocationPrompt,
        description:
          "Used to extract locations from a given text input. This is currently being used for BoM weather alerts to extract location information from the alert text.",
        content: extractLocationPrompt,
        variables: [],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
    ];

    // Check and create each prompt
    for (const promptData of defaultPrompts) {
      await prisma.aIPrompt.upsert({
        where: { name: promptData.name },
        create: promptData,
        update: promptData,
      });
    }

    console.log(
      "---------------------------------------> AI prompts initializated successfully"
    );
  } catch (error) {
    console.error("Error initializing AI prompts:", error);
  }
};
