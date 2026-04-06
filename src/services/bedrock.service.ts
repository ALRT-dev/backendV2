import {
  ConverseCommand,
  ThrottlingException,
  ServiceUnavailableException,
} from "@aws-sdk/client-bedrock-runtime";
import bedrockClient from "../utils/bedrock_client.util.js";
import { config } from "../utils/config.js";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Claude sometimes wraps JSON in markdown code fences and/or appends explanation
 * text after the closing brace. This extracts only the first complete JSON
 * object or array from the response so JSON.parse always succeeds.
 */
const extractJSON = (text: string): string => {
  // Strip opening code fence if present
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .trim();

  // Find the first { or [ and the matching closing } or ]
  const firstBrace = withoutFence.indexOf("{");
  const firstBracket = withoutFence.indexOf("[");

  const useObject =
    firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);

  if (useObject) {
    const lastBrace = withoutFence.lastIndexOf("}");
    if (lastBrace !== -1) return withoutFence.slice(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1) {
    const lastBracket = withoutFence.lastIndexOf("]");
    if (lastBracket !== -1)
      return withoutFence.slice(firstBracket, lastBracket + 1);
  }

  // Fallback: return as-is (will surface a clear parse error)
  return withoutFence;
};

/**
 * Retry with exponential backoff, handling Bedrock throttling and transient errors.
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isThrottling =
        error instanceof ThrottlingException ||
        error?.name === "ThrottlingException" ||
        error?.$metadata?.httpStatusCode === 429;

      const isTransient =
        error instanceof ServiceUnavailableException ||
        error?.name === "ServiceUnavailableException" ||
        error?.$metadata?.httpStatusCode === 503;

      if ((isThrottling || isTransient) && attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        console.log(
          `Bedrock rate limit/transient error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        await delay(delayMs);
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
};

/**
 * Process items in batches with rate limiting to avoid hitting Bedrock throughput limits.
 */
export const processBatchWithRateLimit = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayBetweenBatches: number = 2000,
): Promise<R[]> => {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(
      `---------------------------------------> Processing batch ${
        Math.floor(i / batchSize) + 1
      }/${Math.ceil(items.length / batchSize)} (${batch.length} items)`,
    );

    const batchResults = await Promise.all(
      batch.map((item) => processor(item)),
    );
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      console.log(
        `---------------------------------------> Waiting ${delayBetweenBatches}ms before next batch...`,
      );
      await delay(delayBetweenBatches);
    }
  }

  return results;
};

/**
 * Executes a prompt against AWS Bedrock using the model-agnostic ConverseCommand.
 * The model ID defaults to config.aws.bedrock.modelId but can be overridden per call.
 *
 * @returns The text content of the model's response as a plain string.
 */
export const executePrompt = ({
  model,
  systemPromptContent,
  userPromptContent,
}: {
  model?: string;
  systemPromptContent: string;
  userPromptContent: string;
}): Promise<string> => {
  const modelId = model || config.aws.bedrock.fallbackModelId;
  // const modelId = config.aws.bedrock.fallbackModelId;

  return retryWithBackoff(async () => {
    const command = new ConverseCommand({
      modelId,
      system: [{ text: systemPromptContent }],
      messages: [
        {
          role: "user",
          content: [{ text: userPromptContent }],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.1,
      },
    });

    const response = await bedrockClient.send(command);
    const text = response.output?.message?.content?.[0]?.text;

    if (!text) {
      throw new Error("Bedrock returned an empty response");
    }

    return extractJSON(text);
  });
};

/**
 * Minimal Converse call to verify the model ID is accepted by Bedrock.
 * Success means the runtime recognized the model (or profile); empty output is allowed.
 */
export const validateModelId = (modelId: string): Promise<void> => {
  return retryWithBackoff(async () => {
    const command = new ConverseCommand({
      modelId,
      system: [{ text: "Reply with the single letter A." }],
      messages: [
        {
          role: "user",
          content: [{ text: "A" }],
        },
      ],
      inferenceConfig: {
        maxTokens: 16,
        temperature: 0,
      },
    });

    await bedrockClient.send(command);
  });
};
