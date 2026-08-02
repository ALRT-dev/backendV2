/**
 * Closed-list canonical-hazard matching (pre-model layer).
 *
 * Part of the V2 "cost discipline" principle: match closed lists BEFORE any AI
 * call. This maps the many ways a hazard is described in source feeds onto a
 * small, stable set of canonical hazard keys. The result is passed to the SI
 * extraction prompt as a hint and used as a deterministic fallback, so most
 * alerts get a correct `canonicalHazard` without depending on the model.
 *
 * Keep this list conservative — a wrong match is worse than no match, because
 * the model can still fill the gap from the text.
 */

export type CanonicalHazard =
  | "bushfire"
  | "flood"
  | "storm"
  | "cyclone"
  | "heatwave"
  | "air_quality"
  | "earthquake"
  | "tsunami"
  | "landslide"
  | "road_crash"
  | "transport_disruption"
  | "power_outage"
  | "water_advisory"
  | "biosecurity"
  | "security_incident"
  | "travel_advisory"
  | "marine";

/**
 * Synonyms → canonical hazard. Matching is case-insensitive, whole-word where
 * possible, longest-phrase-first so "total fire ban" beats "fire".
 */
const SYNONYMS: Record<CanonicalHazard, string[]> = {
  bushfire: [
    "bushfire",
    "bush fire",
    "grassfire",
    "grass fire",
    "wildfire",
    "total fire ban",
    "fire danger",
    "fire weather",
    "fire",
  ],
  flood: ["flash flood", "flooding", "flood", "riverine", "dam release"],
  storm: [
    "severe thunderstorm",
    "thunderstorm",
    "damaging wind",
    "severe weather",
    "hail",
    "storm",
  ],
  cyclone: ["tropical cyclone", "cyclone", "typhoon", "hurricane"],
  heatwave: ["heatwave", "heat wave", "extreme heat", "heat health"],
  air_quality: [
    "air quality",
    "hazardous air",
    "smoke haze",
    "poor air",
    "pollution",
    "particulate",
    "pm2.5",
    "aqi",
  ],
  earthquake: ["earthquake", "seismic", "aftershock"],
  tsunami: ["tsunami", "tidal wave"],
  landslide: ["landslide", "landslip", "rockfall"],
  road_crash: [
    "crash",
    "collision",
    "vehicle accident",
    "road accident",
    "car accident",
  ],
  transport_disruption: [
    "road closure",
    "road closed",
    "traffic",
    "rail",
    "train",
    "ferry",
    "public transport",
    "delays",
  ],
  power_outage: ["power outage", "power out", "blackout", "electricity supply"],
  water_advisory: [
    "boil water",
    "do not drink",
    "water quality",
    "water advisory",
    "contaminated water",
  ],
  biosecurity: [
    "biosecurity",
    "disease outbreak",
    "avian influenza",
    "bird flu",
    "foot and mouth",
    "pest",
  ],
  security_incident: [
    "police operation",
    "security incident",
    "armed",
    "active shooter",
    "bomb",
    "suspicious",
    "evacuation order",
    "crime",
  ],
  travel_advisory: [
    "travel advisory",
    "do not travel",
    "reconsider your need to travel",
    "exercise a high degree of caution",
    "smartraveller",
  ],
  marine: [
    "marine wind warning",
    "hazardous surf",
    "coastal",
    "gale warning",
    "storm surge",
    "marine",
  ],
};

/**
 * Flattened, longest-first index so multi-word phrases win over single words.
 */
const INDEX: Array<{ phrase: string; canonical: CanonicalHazard }> =
  Object.entries(SYNONYMS)
    .flatMap(([canonical, phrases]) =>
      phrases.map((phrase) => ({
        phrase: phrase.toLowerCase(),
        canonical: canonical as CanonicalHazard,
      }))
    )
    .sort((a, b) => b.phrase.length - a.phrase.length);

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns the canonical hazard key for a piece of text, or null if nothing in
 * the closed list matches. Phrases are matched on word boundaries so "fire"
 * won't match "firefighter" mid-word incorrectly (it still matches "fire").
 *
 * @param text - Any alert text (title + description works best).
 */
export const matchCanonicalHazard = (
  text: string | null | undefined
): CanonicalHazard | null => {
  if (!text) return null;
  const haystack = text.toLowerCase();

  for (const { phrase, canonical } of INDEX) {
    const boundary = new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`);
    if (boundary.test(haystack)) {
      return canonical;
    }
  }
  return null;
};
