// import type { AIPrompt } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { config } from "../utils/config.js";
import { type AIPrompt, type Prisma } from "@prisma/client";

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

    const userReportedAlertReviewAndSummarizationPrompt = `You are an AI profanity checker and summarizer. Your task is to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.

REVIEW GUIDELINES:
- Check for profanity, nonsense, sexual content, discriminatory language; reject such reports.
- **Don't reject** if description is not provided.
- Provide constructive feedback for improvement **only if rejecting** (max 200 chars).
- Create a clear, concise title (max 80 chars) summarizing the hazard (follow the SUMMARY GUIDELINES below for summary).

SUMMARY GUIDELINES:
Tone Requirements:
- Must start soft and unverified:
  “A user has reported…”
  “An unverified report of…”
  “A possible {hazard} has been shared…”
- Must use simple, calm, plain, natural language (present tense).
- Do not confirm facts.
- Do not mention severity.
- Do not reference agencies.
- Do not use blame or identity descriptors (e.g., “man,” “woman,” “teenager,” “black,” “white”).
- Location must be suburb only, no exact address.
- Must be one sentence, ≤25 words.

Default Summary (mandatory if no description or unverifiable):
- “An unverified incident has been reported near {locationName}.”

Examples:
“A user has reported possible smoke near Suburb.”
“An unverified report of a traffic issue was shared in Suburb.”
“A community member has noted unusual activity in Suburb.”

Internal tone handling
Soft vs. neutral vs. slightly firmer is allowed internally, but must never state or imply severity.

CALL TO ACTION GUIDELINES:
Tone Requirements:
- Must be soft and non-directive.
- Must not imply urgency, risk, or severity.
- Must not instruct safety actions (no evacuation, sheltering, avoiding area, etc.).
- Keep total length ≤25 words.

Allowed (tone tiers)
- Soft:
  “Stay aware of local conditions.”
  “Monitor your surroundings until more information is available.”
- Neutral:
  “Be mindful in the area and refer to official updates if needed.”
  “Stay cautious and look for more information.”
- Slightly Firmer:
  “Take extra care in the area and check official sources for updates.”
  “Stay alert to changing conditions.”

Default Call to Action (mandatory if no description or unverifiable):
- “Stay aware of local conditions and monitor your surroundings.”

FINAL VALIDATION CHECKS:
You must ensure summary and callToAction DO NOT include:
- Severity labels
- Danger or risk language
- Predictions
- Operational instructions
- Commands
- Medical advice
- Blame or identity
- Street addresses
- Sensitive personal data
- Confirmation of facts

You must ensure summary and callToAction DOES include:
- Unverified tone
- Suburb-only location
- User-sourced phrasing
- Soft, non-directive wording
- No exaggeration
- No AWS-level terminology

FINAL OUTPUT EXAMPLE FOR summary AND callToAction:
User submitted:
“I saw a fire starting in the bushes behind the shops.”

AI Output:
summary:
“A user has reported possible fire activity near Rockingham.”

callToAction:
“Stay aware of local conditions and check official updates if needed.”

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
}`;

    const officialAlertSummarizationPrompt = `You are an AI hazard intelligence assistant supporting emergency systems. Your role is to interpret incoming hazard reports, extract key details, and produce clear, actionable summaries, including a concise title, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.

SUMMARY GUIDELINES
Generate “summary” using the following rules:
- MUST be one single sentence
- MUST be ≤ 25 words
- Calm, factual, plain language
- Only information relevant to the hazard type.
- Follow TONE GUIDANCE below for tone.

CALL-TO-ACTION GUIDELINES
First, scan the hazard description for ANY actionable items:
- Direct instructions (“evacuate immediately”, “close windows”, “avoid area”)
- Safety recommendations (“use caution”, “keep medication nearby”)
- Conditional actions (“if property is under threat…”)
- Behaviour instructions (“residents should…”, “motorists should…”)

If ANY exist:
→ Extract, combine, and summarise them into one concise statement.

If NO action exists in the description:
→ Create your own callToAction based on:
   - category
   - context of the hazard
   - TONE GUIDANCE below for tone.


MUST be ≤ 25 words.

TONE GUIDANCE
- Use a calm, neutral, informational tone.
- Do not imply danger, urgency, or action.
- Simply acknowledge that something exists or has been reported.
- Keep the language soft, factual, and non-directive.

WORD LIMITS (STRICT)
- summary ≤ 25 words
- callToAction ≤ 25 words
Shorten aggressively if needed.

CONFIDENCE LEVEL GUIDELINES:
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
}`;

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
