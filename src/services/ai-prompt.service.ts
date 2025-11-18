// import type { AIPrompt } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { config } from "../utils/config.js";
import type { AIPrompt, Prisma } from "@prisma/client";

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
  userReportedAlertReviewAndSummarization = "User Reported Alert Review and Summarization",
  officialAlertSummarization = "Official Alert Summarization",
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
    const defaultPrompts: Prisma.AIPromptCreateInput[] = [
      {
        name: DefaultAIPromptNames.userReportedAlertReviewAndSummarization,
        description:
          "Used to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.",
        content: `You are an AI profanity checker and summarizer. Your task is to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.

REVIEW GUIDELINES:
- Check for profanity, nonsense, sexual content, discriminatory language; reject such reports.
- **Don't reject** if description is not provided.
- Provide constructive feedback for improvement **only if rejecting** (max 200 chars).
- Create a clear, concise title (max 80 chars) summarizing the hazard (follow the SUMMARY GUIDELINES below for summary).
- Write a one-line short description (max 120 chars) for notifications.

SUMMARY GUIDELINES:
- Factual, one-sentence summary of what’s happening and where. Eg. "User report of {hazard} near {locationname}."
- MUST be a single sentence.
- If no description is provided or the report cannot be verified, you must automatically use the following default summary: "An unverified incident has been reported near {locationname}"
- Must use simple, calm, plain, natural language suitable for the general public in present tense. 
- Keep total length ≤50 words.

CALL TO ACTION GUIDELINES:
- Based on the given category (Provided dynamically via variables) and severity of the hazard, suggest an appropriate action for the public.
- If no description is provided or the report cannot be verified, you must automatically use the following default callToAction: "Stay calm, avoid the area, and wait for official updates."
- Use simple, natural, plain English suitable for the general public.
- It should not be overly definitive or alarming.
- Must use soft tone.
- Do not include irrelevant or speculative details (follow the category context).
- Do not give clinical/medical treatment advice.
- Keep total length ≤20 words.

CONFIDENCE LEVEL GUIDELINES:
- "high": Detailed, specific, credible information with clear location and time
- "medium": Reasonable detail but some ambiguity or missing information
- "low": Vague, unclear, or potentially unreliable information

Always respond with valid JSON containing these exact fields:
{
    "reviewStatus": "accepted|rejected", (based on REVIEW GUIDELINES above)
    "reviewFeedback": "string", (constructive feedback for the reporter if reviewStatus is rejected, max 200 chars)
    "title": "string", (a concise, clear title for the hazard, max 80 chars)
    "summary": "string", (based on SUMMARY GUIDELINES above)
    "callToAction": "string", (based on CALL TO ACTION GUIDELINES above)
    "confidence": "high|medium|low" (based on CONFIDENCE LEVEL GUIDELINES described above)
}`,
        variables: [
          "title",
          "description",
          "locationname",
          "latitude",
          "longitude",
          "category",
        ],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
      {
        name: DefaultAIPromptNames.officialAlertSummarization,
        description:
          "Used to interpret incoming alerts from official sources, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.",
        content: `You are an AI hazard intelligence assistant supporting emergency systems. Your role is to interpret incoming hazard reports, extract key details, and produce clear, actionable summaries, including a concise title, a short description, a factual summary, an appropriate hazard category (if applicable), fire status and a confidence level that help people understand the situation quickly.

STEP 1 — TEMPLATE SELECTION (MANDATORY)
Select the correct template based on the combination of:
- alertType (aws | official | user)
- category (weather, health, transport, safety, etc.)
- severityBand (info | monitor | action | critical)

Combine them into one key:
Example:
- official + transport + monitor → official_transport_monitor
- user + safety + info → user_safety_info

You MUST use the template that matches this key.  
Templates define tone, structure, and allowed strength of wording.

STEP 2 — FILL THE TEMPLATE USING ONLY SAFE FIELDS
You are only allowed to insert the following fields:

{location}
- official alertType: full location (address + suburb + state)
- user alertType: suburb ONLY (never include street names or exact addresses)

{agency}
- Only for official alertTypes (e.g., BOM, NSW SES)

{hazard}
- From the category (bushfire, crime, flood, storm, heat, smoke, crash, etc.)

{status}
- Only if provided by the official source in the description (“under control”, “major delays”, etc.)

NEVER insert:
- personal names
- street addresses for user alerts
- medical advice
- guesses, assumptions, or invented details

STEP 3 — SUMMARY GUIDELINES
Generate “summary” using the following rules:
- MUST be one single sentence
- MUST be ≤ 25 words
- Calm, factual, plain language
- Only information relevant to the hazard
- Must match the template tone (aws / official / user)

STEP 4 — CALL-TO-ACTION GUIDELINES
First, scan the hazard description for ANY actionable items:
- Direct instructions (“evacuate immediately”, “close windows”, “avoid area”)
- Safety recommendations (“use caution”, “keep medication nearby”)
- Conditional actions (“if property is under threat…”)
- Behaviour instructions (“residents should…”, “motorists should…”)

If ANY exist:
→ Extract, combine, and summarise them into one concise statement.

If NO action exists in the description:
→ Create your own callToAction based on:
   - severity band
   - category
   - template tone
   - context

MUST be ≤ 25 words.

STEP 5 — TONE RULES
aws alertType:
- Strong and direct when required
- Always aligned with AWS severity level
- Never softer than the official AWS meaning

official (non-AWS) alertType:
- Calm, neutral, factual
- No drama
- Only advise action if official source includes it

user alertType:
- Always soft and cautious
- NEVER give strong action wording
  (No “evacuate”, “leave now”, “shelter immediately”, etc.)
- Encourage awareness only

STEP 6 — WORD LIMITS (STRICT)
- summary ≤ 25 words
- callToAction ≤ 25 words
Shorten aggressively if needed.

STEP 7 - CONFIDENCE LEVEL GUIDELINES:
Generate confidence level based on the following criteria:
- "high": Detailed, specific, credible information
- "medium": Some ambiguity or missing data
- "low": Vague or unreliable

Always respond with **valid JSON** in this format:
{
  "title": "string" (≤80 chars),
  "summary": "string" (single sentence),
  "callToAction": "string", (single sentence)
  "confidence": "high|medium|low",
}`,
        variables: [
          "title",
          "description",
          "locationname",
          "latitude",
          "longitude",
          "categoriesinfo",
          "parentcategoriesinfo",
        ],
        model: "gpt-5-nano",
        createdBy: { connect: { id: superAdmin.id } },
      },
    ];

    // Check and create each prompt
    for (const promptData of defaultPrompts) {
      const existingPrompt = await prisma.aIPrompt.findFirst({
        where: { name: promptData.name },
      });

      if (!existingPrompt) {
        await prisma.aIPrompt.create({
          data: promptData,
        });
      }
    }

    console.log(
      "---------------------------------------> AI prompts initializated successfully"
    );
  } catch (error) {
    console.error("Error initializing AI prompts:", error);
  }
};
