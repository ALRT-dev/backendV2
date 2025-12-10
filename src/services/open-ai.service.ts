import openai from "../utils/open_ai_client.util.js";

/**
 * Utility function to add delay between API calls
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Utility function to retry API calls with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // If it's a rate limit error and we have retries left
      if (error?.status === 429 && attempt < maxRetries) {
        // Don't retry if it's a quota exceeded error (insufficient_quota)
        if (
          error?.code === "insufficient_quota" ||
          error?.type === "insufficient_quota"
        ) {
          console.log(
            "OpenAI quota exceeded, not retrying. Please check your billing and quota limits."
          );
          throw error;
        }

        const retryAfterMs =
          error?.headers?.["retry-after-ms"] ||
          (error?.headers?.["retry-after"]
            ? parseInt(error.headers["retry-after"]) * 1000
            : null);
        const delayMs = retryAfterMs || baseDelay * Math.pow(2, attempt);

        console.log(
          `Rate limit hit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${
            maxRetries + 1
          })`
        );
        await delay(delayMs);
        continue;
      }

      // If it's not a rate limit error or we're out of retries, throw
      throw error;
    }
  }

  throw lastError!;
};

/**
 * Process items in batches with rate limiting to avoid hitting OpenAI rate limits
 */
export const processBatchWithRateLimit = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayBetweenBatches: number = 2000
): Promise<R[]> => {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(
      `---------------------------------------> Processing batch ${
        Math.floor(i / batchSize) + 1
      }/${Math.ceil(items.length / batchSize)} (${batch.length} items)`
    );

    const batchResults = await Promise.all(
      batch.map((item) => processor(item))
    );

    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      console.log(
        `---------------------------------------> Waiting ${delayBetweenBatches}ms before next batch...`
      );
      await delay(delayBetweenBatches);
    }
  }

  return results;
};

/**
 * Executes a prompt against the OpenAI API with retry logic.
 *
 * @param model - The OpenAI model to use.
 * @param systemPromptContent - The system prompt content.
 * @param userPromptContent - The user prompt content.
 * @returns {Promise<any>} The response from the OpenAI API.
 */
export const executePrompt = ({
  model,
  systemPromptContent,
  userPromptContent,
}: {
  model: string;
  systemPromptContent: string;
  userPromptContent: string;
}): Promise<any> => {
  return retryWithBackoff(async () => {
    return await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPromptContent },
        { role: "user", content: userPromptContent },
      ],
      response_format: { type: "json_object" },
    });
  });
};
