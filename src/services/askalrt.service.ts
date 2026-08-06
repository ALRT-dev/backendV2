import prisma from "../utils/prisma_client.util.js";
import { getCacheClient } from "../utils/cache_client.util.js";
import { config } from "../utils/config.js";
import { executePrompt } from "./ai.service.js";
import { getPromptByName } from "./ai-prompt.service.js";
import { hasActiveSubscription } from "./entitlement.service.js";

/**
 * Ask ALRT — library-first safety assistant (ported from the askalrt
 * Firebase design pass onto this backend).
 *
 * Three answer tiers, using AI as little as possible:
 *   1. Pre-written library (zero AI, unlimited) — keyword/phrase matcher.
 *   2. Emergency-number lookup (zero AI, unlimited).
 *   3. AI fallback grounded ONLY in nearby active alerts, capped per day
 *      (3 free / 20 ALRT+). No transcripts are stored — only counts.
 */

export type AskTier = "library" | "emergency" | "ai" | "limitReached";

export type ReferencedAlert = {
  id: string;
  title: string;
  sourceName: string | null;
  severityBand: string | null;
};

export type AskAlrtResult = {
  answer: string;
  tier: AskTier;
  /** Remaining AI questions today; null for the unlimited tiers. */
  remainingAiQuestions: number | null;
  referencedAlerts: ReferencedAlert[];
};

const FREE_DAILY_AI_LIMIT = 3;
const PLUS_DAILY_AI_LIMIT = 20;

// ---------------------------------------------------------------------------
// Tier 1 — seed answer library. A phrase hit is a strong match; otherwise two
// or more keyword hits match. Answers are safety-reviewed copy, not AI output.
// ---------------------------------------------------------------------------

type LibraryEntry = {
  id: string;
  triggers: string[];
  keywords: string[];
  answer: string;
};

const SEED_LIBRARY: LibraryEntry[] = [
  {
    id: "severity_levels",
    triggers: [
      "what does watch and act mean",
      "what do the alert levels mean",
      "what does advice mean",
      "alert colours",
      "alert colors",
    ],
    keywords: ["watch", "act", "advice", "emergency", "level", "severity", "warning", "mean"],
    answer:
      "Australian warnings use three levels. Advice (yellow): an incident is happening nearby, stay informed. Watch and Act (orange): conditions are changing, start taking action to protect yourself and your family. Emergency Warning (red): you are in danger and need to act immediately. ALRT shows each alert's level on its card and pin.",
  },
  {
    id: "report_alert",
    triggers: ["how do i report", "how to report a hazard", "post an alert"],
    keywords: ["report", "submit", "post", "hazard", "alert"],
    answer:
      "Tap the ALRT button in the middle of the bottom bar, pick the category that fits, add a photo if it is safe to take one, and submit. Reports are reviewed before they go live, and accurate reports earn points.",
  },
  {
    id: "bushfire_prepare",
    triggers: ["how do i prepare for a bushfire", "bushfire plan"],
    keywords: ["bushfire", "fire", "prepare", "plan", "season"],
    answer:
      "Key steps: make a written bushfire survival plan with your household, know your trigger to leave early, prepare an emergency kit (water, medications, documents, phone charger), clear leaves and debris around the home, and keep ALRT notifications on for your area. Leaving early is always the safest option.",
  },
  {
    id: "flood_safety",
    triggers: ["is it safe to drive through flood water", "flood water"],
    keywords: ["flood", "floodwater", "water", "drive", "cross", "road"],
    answer:
      "Never drive, ride or walk through flood water. It only takes 15cm of moving water to float a small car, and flooded roads may be washed away underneath. If your route is flooded, turn around and find another way. Check alerts in ALRT before travelling.",
  },
  {
    id: "storm_prepare",
    triggers: ["how do i prepare for a storm", "severe storm coming"],
    keywords: ["storm", "hail", "wind", "prepare", "thunderstorm"],
    answer:
      "Before a storm: secure loose outdoor items, park vehicles undercover or away from trees, unplug sensitive electronics, and charge your phone. During: stay indoors away from windows. If there is flooding or building damage, call the SES on 132 500.",
  },
  {
    id: "heatwave",
    triggers: ["heatwave", "extreme heat"],
    keywords: ["heat", "heatwave", "hot", "temperature"],
    answer:
      "In extreme heat: drink water regularly, stay in the coolest part of the home or an air-conditioned public place, avoid strenuous activity in the middle of the day, never leave children or pets in cars, and check on older neighbours and anyone unwell.",
  },
  {
    id: "points",
    triggers: ["how do points work", "what are points for", "what is xp"],
    keywords: ["points", "xp", "score", "trust", "tier"],
    answer:
      "Points reward accuracy, never volume. You earn points when your report is approved, when others corroborate it, when an official source later confirms it, and when you finish safety guides. See Profile then How points work for the full breakdown.",
  },
  {
    id: "family_mode",
    triggers: ["what is family mode", "how does family work", "add family"],
    keywords: ["family", "circle", "sos", "check in", "invite"],
    answer:
      "Family mode lets a private circle share one-off location snapshots, check-ins and SOS alerts. There is no continuous tracking: the only live location share is an SOS you start yourself, and it stops automatically. Set it up from the Family tab.",
  },
  {
    id: "notifications",
    triggers: ["how do i change notifications", "too many notifications", "stop notifications"],
    keywords: ["notification", "notifications", "push", "mute", "settings"],
    answer:
      "Go to Profile then Manage notifications to choose which severity levels and categories notify you, and for which locations. Emergency Warnings for your subscribed areas are worth keeping on.",
  },
  {
    id: "alrt_plus",
    triggers: ["what is alrt plus", "what do i get with alrt+", "subscription price"],
    keywords: ["plus", "subscription", "subscribe", "premium", "price", "cost"],
    answer:
      "ALRT+ unlocks the premium features shown on the ALRT+ screen, including more Ask ALRT questions each day. Pricing is shown in the app in your local currency, with a one month free trial.",
  },
];

const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchLibrary = (question: string): LibraryEntry | null => {
  const q = normalise(question);
  if (!q) return null;

  for (const entry of SEED_LIBRARY) {
    if (entry.triggers.some((t) => q.includes(normalise(t)))) return entry;
  }

  const words = new Set(q.split(" "));
  let best: LibraryEntry | null = null;
  let bestHits = 0;
  for (const entry of SEED_LIBRARY) {
    const hits = entry.keywords.filter((k) => words.has(k)).length;
    if (hits > bestHits) {
      best = entry;
      bestHits = hits;
    }
  }
  return bestHits >= 2 ? best : null;
};

// ---------------------------------------------------------------------------
// Tier 2 — emergency number lookup. Australia-first product; the answer keeps
// the "if overseas" caveat rather than guessing the caller's country.
// ---------------------------------------------------------------------------

const EMERGENCY_PATTERNS = [
  /emergency number/,
  /who (do|should) i (call|ring)/,
  /number (do|should) i (call|ring)/,
  /call in an emergency/,
  /\btriple zero\b/,
  /\b000\b/,
];

const isEmergencyNumberQuestion = (question: string): boolean => {
  const q = normalise(question);
  return EMERGENCY_PATTERNS.some((p) => p.test(q));
};

const EMERGENCY_ANSWER =
  "In Australia call 000 (Triple Zero) for police, fire or ambulance when life or property is in danger. From a mobile, 112 also works. For storm and flood help that is not life-threatening, call the SES on 132 500. If you are outside Australia, use that country's local emergency number.";

// ---------------------------------------------------------------------------
// Tier 3 — AI fallback, grounded in nearby active alerts, counted per day.
// Only content-free counts are stored; questions and answers are not logged.
// ---------------------------------------------------------------------------

const utcDay = (): string => new Date().toISOString().slice(0, 10);

/**
 * Increments and returns today's AI-question count for the user. When the
 * cache is unavailable the count is untracked (returns 1) — the assistant
 * stays usable and cost exposure is bounded by the API rate limiters.
 */
const bumpDailyAiCount = async (userId: string): Promise<number> => {
  const redis = getCacheClient();
  if (!redis) return 1;
  try {
    const key = `askalrt:ai:${userId}:${utcDay()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60 * 48);
    return count;
  } catch {
    return 1;
  }
};

type NearbyAlert = {
  id: string;
  title: string | null;
  severityBand: string | null;
  locationName: string | null;
  aiSummary: string | null;
  source: { name: string | null } | null;
};

/** Active, accepted alerts inside a ~55km box around the user. */
const getNearbyAlerts = async (
  latitude?: number,
  longitude?: number,
): Promise<NearbyAlert[]> => {
  if (latitude === undefined || longitude === undefined) return [];
  const d = 0.5;
  return prisma.hazard.findMany({
    where: {
      reviewStatus: "accepted",
      latitude: { gte: latitude - d, lte: latitude + d },
      longitude: { gte: longitude - d, lte: longitude + d },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      severityBand: true,
      locationName: true,
      aiSummary: true,
      source: { select: { name: true } },
    },
  });
};

/** Admin-console name of the Ask ALRT system prompt (AI Prompts section). */
export const ASK_ALRT_PROMPT_NAME = "ask_alrt_system";

/**
 * Built-in fallback used only when the '{@link ASK_ALRT_PROMPT_NAME}' prompt
 * row is missing. The editable copy lives in the AIPrompt table so admins can
 * tune tone and rules from the console without a deploy — but the JSON output
 * contract in rule 5 must be preserved in any edit, or source chips and
 * answer parsing degrade to a plain-text fallback.
 */
const DEFAULT_SYSTEM_PROMPT = `You are Ask ALRT, the safety assistant inside the ALRT alerting app for Australia.

Rules, in priority order:
1. Ground every factual claim ONLY in the alerts provided in the message. Never invent alerts, closures, fires or conditions. If the provided alerts do not cover the question, say you have no alert information about that and give brief general safety guidance instead.
2. Never declare a situation safe. When asked "is it safe", describe what the official sources say and add that you cannot judge overall safety.
3. If the question suggests immediate danger to life, tell the user to call 000 now.
4. Be brief: at most 120 words, plain language, short sentences. No en-dashes.
5. Respond with STRICT JSON only, no markdown fences: {"answer": "...", "usedAlertIds": ["id", ...]} where usedAlertIds lists only alert ids you actually relied on (empty array if none).`;

/**
 * Creates the Ask ALRT prompt row once so it shows up in the admin console's
 * AI Prompts section. Never overwrites an existing row, so console edits
 * survive deploys. Called on boot; failures must not block startup.
 */
export const ensureAskAlrtPrompt = async (): Promise<void> => {
  try {
    const existing = await prisma.aIPrompt.findUnique({
      where: { name: ASK_ALRT_PROMPT_NAME },
    });
    if (existing) return;

    const superAdmin = await prisma.admin.findUnique({
      where: { email: config.adminCredentials.superAdminEmail },
    });
    if (!superAdmin) return;

    const group = await prisma.aIPromptGroup.findUnique({
      where: { name: "Other" },
    });

    await prisma.aIPrompt.create({
      data: {
        name: ASK_ALRT_PROMPT_NAME,
        description:
          "System prompt for the Ask ALRT assistant (AI fallback tier). " +
          "Edits apply within ~5 minutes, no deploy needed. Keep rule 5's " +
          "strict-JSON output contract intact.",
        content: DEFAULT_SYSTEM_PROMPT,
        variables: [],
        model: config.aws.bedrock.fallbackModelId,
        groupId: group?.id ?? null,
        createdById: superAdmin.id,
      },
    });
  } catch (error) {
    console.error("❌ Ask ALRT prompt initialization failed:", error);
  }
};

/** Console-edited prompt when available, built-in copy otherwise. */
const getSystemPrompt = async (): Promise<{
  content: string;
  model?: string;
}> => {
  try {
    const prompt = await getPromptByName(ASK_ALRT_PROMPT_NAME);
    return { content: prompt.content, model: prompt.model };
  } catch {
    return { content: DEFAULT_SYSTEM_PROMPT };
  }
};

const extractJson = (
  raw: string,
): { answer: string; usedAlertIds: string[] } | null => {
  const cleaned = raw
    .replace(/^```(?:json)?/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      answer?: unknown;
      usedAlertIds?: unknown;
    };
    if (typeof parsed.answer !== "string" || !parsed.answer.trim()) return null;
    const ids = Array.isArray(parsed.usedAlertIds)
      ? parsed.usedAlertIds.filter((x): x is string => typeof x === "string")
      : [];
    return { answer: parsed.answer.trim(), usedAlertIds: ids };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------

export const askAlrt = async (params: {
  userId: string;
  question: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
}): Promise<AskAlrtResult> => {
  const { userId, question, latitude, longitude } = params;

  const libraryHit = matchLibrary(question);
  if (libraryHit) {
    return {
      answer: libraryHit.answer,
      tier: "library",
      remainingAiQuestions: null,
      referencedAlerts: [],
    };
  }

  if (isEmergencyNumberQuestion(question)) {
    return {
      answer: EMERGENCY_ANSWER,
      tier: "emergency",
      remainingAiQuestions: null,
      referencedAlerts: [],
    };
  }

  // Entitlement through the same service every other gate uses (plan
  // field, pre-billing aware) rather than the parallel isPlus model the
  // source branch carried.
  const isPlus = await hasActiveSubscription(userId);
  const dailyLimit = isPlus ? PLUS_DAILY_AI_LIMIT : FREE_DAILY_AI_LIMIT;

  const used = await bumpDailyAiCount(userId);
  if (used > dailyLimit) {
    return {
      answer: isPlus
        ? "You have used all of today's Ask ALRT questions. Your questions reset tomorrow. Live alerts on the map are always available and unlimited."
        : "You have used today's 3 free Ask ALRT questions. ALRT+ includes 20 a day, or your free questions reset tomorrow. Live alerts on the map are always available and unlimited.",
      tier: "limitReached",
      remainingAiQuestions: 0,
      referencedAlerts: [],
    };
  }

  const nearby = await getNearbyAlerts(latitude, longitude);
  const alertsBlock = nearby.length
    ? nearby
        .map(
          (a) =>
            `- id=${a.id} | level=${a.severityBand ?? "unknown"} | ${a.title ?? "Untitled"} | ${a.locationName ?? "location unknown"} | source=${a.source?.name ?? "community report"}${a.aiSummary ? ` | ${a.aiSummary.slice(0, 200)}` : ""}`,
        )
        .join("\n")
    : "(no active alerts near the user)";

  const systemPrompt = await getSystemPrompt();
  const raw = await executePrompt({
    ...(systemPrompt.model ? { model: systemPrompt.model } : {}),
    systemPromptContent: systemPrompt.content,
    userPromptContent: `Active alerts near the user right now:\n${alertsBlock}\n\nUser question: ${question.slice(0, 500)}`,
  });

  const parsed = extractJson(raw);
  const answer =
    parsed?.answer ??
    "I could not put together a reliable answer just now. Please check the alerts on the map, and if you are in immediate danger call 000.";

  const referenced: ReferencedAlert[] = (parsed?.usedAlertIds ?? [])
    .map((id) => nearby.find((a) => a.id === id))
    .filter((a): a is NearbyAlert => Boolean(a))
    .map((a) => ({
      id: a.id,
      title: a.title ?? "Alert",
      sourceName: a.source?.name ?? null,
      severityBand: a.severityBand,
    }));

  return {
    answer,
    tier: "ai",
    remainingAiQuestions: Math.max(0, dailyLimit - used),
    referencedAlerts: referenced,
  };
};
