import { HazardSeverityBand } from "@prisma/client";

/**
 * Deterministic severity band scan.
 *
 * V2 principle: the AI NEVER sets severity. The band (Info / Monitor / Action /
 * Critical) is decided here, in plain Node, from keywords keyed on the SOURCE —
 * not from free-text sentiment. This keeps banding auditable and consistent,
 * and lets the AI stay a pure extractor.
 *
 * The mapping mirrors the source registry's action statements. Australian
 * Warning System (AWS) sources publish three official action statements which
 * map onto our four internal bands:
 *   - "Advice"        -> monitor
 *   - "Watch and Act" -> action
 *   - "Emergency Warning" -> critical
 * Air-quality sources band on AQI category words; travel advisories band on the
 * Smartraveller advisory levels; everything else falls back to keyword tiers.
 */

export interface SeverityScanInput {
  /** The name of the source agency/feed, e.g. "NSW RFS", "Smartraveller". */
  sourceName?: string | null;
  /** Title + description (or any alert text) to scan. */
  text?: string | null;
}

/** Ordered high→low so the first hit wins. */
interface BandRule {
  band: HazardSeverityBand;
  keywords: string[];
}

const contains = (haystack: string, keyword: string): boolean =>
  haystack.includes(keyword.toLowerCase());

/**
 * Australian Warning System action statements. Applied to any source whose
 * name looks like an emergency-services / AWS publisher, but the keywords are
 * distinctive enough to be safe as a general high-priority pass too.
 */
const AWS_RULES: BandRule[] = [
  {
    band: HazardSeverityBand.critical,
    keywords: [
      "emergency warning",
      "take shelter now",
      "too late to leave",
      "you are in danger",
      "evacuate now",
    ],
  },
  {
    band: HazardSeverityBand.action,
    keywords: ["watch and act", "prepare to leave", "leave now", "act now"],
  },
  {
    band: HazardSeverityBand.monitor,
    keywords: ["advice", "be aware", "monitor conditions", "stay informed"],
  },
];

/** Air-quality banding on AQI category words. */
const AIR_QUALITY_RULES: BandRule[] = [
  {
    band: HazardSeverityBand.critical,
    keywords: ["hazardous"],
  },
  {
    band: HazardSeverityBand.action,
    keywords: ["very poor", "very unhealthy"],
  },
  {
    band: HazardSeverityBand.monitor,
    keywords: ["poor", "unhealthy", "fair"],
  },
];

/** Smartraveller travel-advisory levels. */
const TRAVEL_RULES: BandRule[] = [
  {
    band: HazardSeverityBand.critical,
    keywords: ["do not travel"],
  },
  {
    band: HazardSeverityBand.action,
    keywords: ["reconsider your need to travel"],
  },
  {
    band: HazardSeverityBand.monitor,
    keywords: ["exercise a high degree of caution"],
  },
];

/** Generic fallback keyword tiers for sources without a specific ruleset. */
const GENERIC_RULES: BandRule[] = [
  {
    band: HazardSeverityBand.critical,
    keywords: ["emergency", "evacuate", "life threatening", "severe"],
  },
  {
    band: HazardSeverityBand.action,
    keywords: ["warning", "damaging", "dangerous", "major"],
  },
  {
    band: HazardSeverityBand.monitor,
    keywords: ["watch", "minor", "caution", "advice"],
  },
];

const applyRules = (
  text: string,
  rules: BandRule[]
): HazardSeverityBand | null => {
  for (const rule of rules) {
    if (rule.keywords.some((k) => contains(text, k))) {
      return rule.band;
    }
  }
  return null;
};

const looksLikeAirQuality = (source: string, text: string): boolean =>
  source.includes("air") ||
  contains(text, "air quality") ||
  contains(text, "aqi");

const looksLikeTravel = (source: string, text: string): boolean =>
  source.includes("smartraveller") || contains(text, "travel advisory");

/**
 * Returns the severity band for an alert, deterministically. Defaults to
 * `info` when nothing matches — never guesses upward.
 */
export const scanSeverityBand = ({
  sourceName,
  text,
}: SeverityScanInput): HazardSeverityBand => {
  const source = (sourceName ?? "").toLowerCase();
  const body = (text ?? "").toLowerCase();

  if (!body && !source) return HazardSeverityBand.info;

  // Source-specific rulesets first, then AWS action statements, then generic.
  const ordered: BandRule[][] = [];
  if (looksLikeAirQuality(source, body)) ordered.push(AIR_QUALITY_RULES);
  if (looksLikeTravel(source, body)) ordered.push(TRAVEL_RULES);
  ordered.push(AWS_RULES, GENERIC_RULES);

  for (const rules of ordered) {
    const band = applyRules(body, rules);
    if (band) return band;
  }

  return HazardSeverityBand.info;
};
