import { HttpError } from "../models/http_error.js";
import { config } from "../utils/config.js";
import * as bedrock from "./bedrock.service.js";
import * as openai from "./open-ai.service.js";

const isBedrockInvalidModelError = (err: unknown): boolean => {
  const e = err as { name?: string };
  return (
    e?.name === "ResourceNotFoundException" || e?.name === "ValidationException"
  );
};

const isOpenAiInvalidModelError = (err: unknown): boolean => {
  const e = err as {
    status?: number;
    code?: string;
    param?: string;
    error?: { code?: string; param?: string };
  };
  if (!e) return false;
  if (e.status === 404) return true;
  if (e.code === "model_not_found" || e.error?.code === "model_not_found") {
    return true;
  }
  if (e.status === 400 && (e.param === "model" || e.error?.param === "model")) {
    return true;
  }
  return false;
};

type ExecutePromptParams = {
  model?: string;
  systemPromptContent: string;
  userPromptContent: string;
};

/**
 * Provider-agnostic facade for AI prompt execution.
 *
 * Routes to AWS Bedrock (Claude) or OpenAI depending on the AI_PROVIDER env var.
 * Defaults to Bedrock. Set AI_PROVIDER=openai to switch back to OpenAI with no
 * code changes required.
 *
 * Always returns the text content as a plain string, regardless of provider.
 */
export const executePrompt = async (
  params: ExecutePromptParams,
): Promise<string> => {
  if (config.ai.provider === "openai") {
    const response = await openai.executePrompt({
      model: params.model ?? "gpt-4o-mini",
      systemPromptContent: params.systemPromptContent,
      userPromptContent: params.userPromptContent,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }
    return content;
  }

  return bedrock.executePrompt(params);
};

/**
 * Process items in batches with rate limiting.
 * Delegates to the active provider's batch processor.
 */
export const processBatchWithRateLimit = <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize?: number,
  delayBetweenBatches?: number,
): Promise<R[]> => {
  if (config.ai.provider === "openai") {
    return openai.processBatchWithRateLimit(
      items,
      processor,
      batchSize,
      delayBetweenBatches,
    );
  }

  return bedrock.processBatchWithRateLimit(
    items,
    processor,
    batchSize,
    delayBetweenBatches,
  );
};

/**
 * Verifies the model ID against the configured AI provider (Bedrock or OpenAI).
 * Throws HttpError 400 when the provider rejects the model; other errors propagate.
 */
export const validateModelId = async (modelId: string): Promise<void> => {
  const id = modelId.trim();
  if (!id) {
    throw new HttpError(400, "Model ID is required");
  }

  const provider = config.ai.provider;

  try {
    if (provider === "openai") {
      await openai.validateModelId(id);
    } else {
      await bedrock.validateModelId(id);
    }
  } catch (err) {
    if (provider === "openai" && isOpenAiInvalidModelError(err)) {
      throw new HttpError(
        400,
        `"${id}" is an invalid or unavailable OpenAI model ID`,
      );
    }
    if (provider !== "openai" && isBedrockInvalidModelError(err)) {
      throw new HttpError(
        400,
        `"${id}" is an invalid or unavailable Bedrock model ID`,
      );
    }
    throw err;
  }
};
