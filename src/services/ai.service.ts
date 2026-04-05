import { config } from "../utils/config.js";
import * as bedrock from "./bedrock.service.js";
import * as openai from "./open-ai.service.js";

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
