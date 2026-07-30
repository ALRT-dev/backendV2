import { AIConfidence } from "@prisma/client";
import { executePrompt } from "./open-ai.service.js";
import {
  DefaultAIPromptNames,
  getRawPromptByName,
} from "./ai-prompt.service.js";
import { getSIExtractionPrompt } from "../utils/ai-prompt.util.js";
import {
  matchCanonicalHazard,
  type CanonicalHazard,
} from "../utils/canonical_hazard.util.js";

/**
 * Situational-Information (SI) extraction service.
 *
 * The V2 extraction-only AI step. Given a raw alert, it returns a fixed,
 * card-ready JSON object. It deliberately does NOT return a severity band or
 * any advice — banding is the deterministic keyword scan
 * (`severity_scan.service.ts`) and advice comes from the pre-written For You
 * library. This keeps the AI a pure extractor.
 *
 * Cost discipline: a closed-list `canonicalHazard` match runs BEFORE the model
 * and is passed in as a hint, so most alerts are categorised without relying on
 * the LLM, and the model call can be cached on a text hash by the caller.
 */

const DEFAULT_MODEL = "gpt-5-nano";

export interface SIExtractionInput {
  title: string;
  description: string;
  /** Named issuing agency, if known (e.g. "NSW RFS"). */
  sourceAgency?: string | null;
  /** A location hint from a structured field (CAP area etc.), if available. */
  locationHint?: string | null;
  /** Override the model; defaults to the same nano model the other prompts use. */
  model?: string;
}

export interface SIExtractionResult {
  /** One plain-language sentence describing what is happening. */
  plainMeaning: string;
  /** Discrete facts pulled from the source text. */
  facts: string[];
  /** The canonical hazard key (closed-list match preferred). */
  canonicalHazard: CanonicalHazard | string;
  /** Place name(s) only — never a street address. */
  location: string[];
  /** Extraction confidence. */
  confidence: AIConfidence;
}

const substitute = (
  template: string,
  vars: Record<string, string>
): string => {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return out;
};

/**
 * Resolves the SI extraction system prompt. Prefers the DB-managed prompt (so
 * it can be tuned from the admin portal), and falls back to the in-code default
 * when it hasn't been seeded — the service therefore works on any database.
 */
const getSIExtractionTemplate = async (): Promise<string> => {
  try {
    return await getRawPromptByName(DefaultAIPromptNames.siExtraction);
  } catch {
    return getSIExtractionPrompt();
  }
};

const toConfidence = (value: unknown): AIConfidence => {
  switch (String(value).toLowerCase()) {
    case "high":
      return AIConfidence.high;
    case "medium":
      return AIConfidence.medium;
    default:
      return AIConfidence.low;
  }
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
};

/**
 * Extracts situational information from a single alert.
 *
 * @param input - The raw alert fields.
 * @returns A fixed, card-ready extraction result. Never throws for a bad model
 *   response — it degrades to the closed-list match with low confidence.
 */
export const extractHazardInfo = async (
  input: SIExtractionInput
): Promise<SIExtractionResult> => {
  const { title, description } = input;
  const combinedText = `${title}\n${description}`;

  // Pre-model closed-list match (cheap, deterministic).
  const canonicalHint = matchCanonicalHazard(combinedText) ?? "";

  const template = await getSIExtractionTemplate();
  const systemPromptContent = substitute(template, {
    title: title ?? "",
    description: description ?? "",
    sourceAgency: input.sourceAgency ?? "",
    locationHint: input.locationHint ?? "",
    canonicalHazardHint: canonicalHint,
  });

  // Fallback result if the model output can't be used.
  const fallback: SIExtractionResult = {
    plainMeaning: "",
    facts: [],
    canonicalHazard: canonicalHint,
    location: input.locationHint ? [input.locationHint] : [],
    confidence: AIConfidence.low,
  };

  try {
    const response = await executePrompt({
      model: input.model ?? DEFAULT_MODEL,
      systemPromptContent,
      userPromptContent: JSON.stringify({ title, description }),
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return fallback;

    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      plainMeaning:
        typeof parsed.plainMeaning === "string" ? parsed.plainMeaning : "",
      facts: asStringArray(parsed.facts),
      // Trust the closed-list match first; only use the model's guess when the
      // deterministic layer found nothing.
      canonicalHazard:
        canonicalHint ||
        (typeof parsed.canonicalHazard === "string"
          ? parsed.canonicalHazard
          : ""),
      location: asStringArray(parsed.location),
      confidence: toConfidence(parsed.confidence),
    };
  } catch (error) {
    console.error("SI extraction failed, using closed-list fallback:", error);
    return fallback;
  }
};
