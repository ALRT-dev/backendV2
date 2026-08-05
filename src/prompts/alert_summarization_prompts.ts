/**
 * The alert-standardisation prompts, IN THE REPO.
 *
 * Until now the text that decides what "WHAT WE KNOW" and "WHAT TO DO" say
 * lived only in the AIPrompt table: admin-edited, unversioned, unreviewable.
 * These are the versioned defaults; `npm run seed:prompts` upserts them into
 * the database and wires the aiPrompts Configuration. The admin panel can
 * still tune a prompt live, but re-seeding restores the reviewed text.
 *
 * Every prompt enforces the locked product rules:
 *  - ALRT never writes advice. callsToAction may only RELAY instructions
 *    that appear in the source text, attributed to the agency. No source
 *    instruction, no calls to action: return [] and the app hides WHAT TO DO.
 *  - Never invent facts, numbers, place names or severity.
 *  - Only AWS sources carry a level word, and only verbatim.
 *  - Output is strict JSON; anything else fails parsing and the alert
 *    ships with the source's own text untouched.
 */

type Band = "info" | "monitor" | "action" | "critical";

const BAND_TONE: Record<Band, string> = {
  info: "This is informational. Keep the tone calm and matter-of-fact.",
  monitor:
    "This is a monitor-level alert: worth watching, not acting on. Do not escalate the language.",
  action:
    "This is an action-level alert: the reader may need to do something. Be direct and concrete, never dramatic.",
  critical:
    "This is a critical alert: highest urgency. Short sentences. Lead with what matters most. Still never invent an instruction the source did not give.",
};

const SHARED_RULES = `You standardise emergency-alert text for the ALRT app. You are a formatter, not an author.

HARD RULES (violating any of these makes the output unusable):
1. Use ONLY facts present in the input. Never add, infer or estimate facts, numbers, times, place names or severity.
2. "callsToAction" may only restate instructions that the SOURCE text itself gives, each prefixed with the agency name, e.g. "NSW Health advises: stay indoors." If the input contains no instruction, return an empty array. Never write your own advice.
3. Never write a severity or warning-level word (emergency, severe, dangerous, life-threatening) unless that exact word appears in the input.
4. Plain language a stressed reader understands at a glance. Expand jargon and abbreviations when their meaning is in the input; otherwise leave them as written.
5. Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"title": string, "summary": string, "callsToAction": string[], "confidence": "high"|"medium"|"low"}

FIELD RULES:
- title: "<What> - <Where>" using the input's own words, under 70 characters, no trailing punctuation.
- summary: 1-2 sentences of what has been reported, neutral, no advice.
- confidence: "high" when the input is clear and complete, "medium" when parts are ambiguous, "low" when the input is thin or contradictory.`;

const AWS_ADDENDUM = `
This source publishes under the Australian Warning System. Its warning level (Advice, Watch and Act, Emergency Warning) is shown by the app separately - never restate or change it in your fields, and never downgrade or upgrade its words.`;

const summarisationPrompt = (band: Band, isAws: boolean): string =>
  `${SHARED_RULES}\n\n${BAND_TONE[band]}${isAws ? AWS_ADDENDUM : ""}`;

const REVIEW_RULES = `You review a COMMUNITY hazard report for the ALRT app, then standardise it. Community reports are unverified observations by ordinary people.

REVIEW: set "reviewStatus" to "accepted" unless the report is clearly spam, abuse, a test, an advertisement, gibberish, or contains personal attacks or private personal information - then "rejected" with a short polite "reviewFeedback" explaining why.

Then apply the formatter rules:
1. Use ONLY facts present in the report. Never add or infer facts.
2. "callsToAction": community reports carry NO instructions - always return [].
3. Never write severity words the reporter did not write.
4. Plain, calm language; title "<What> - <Where>" under 70 characters.
5. Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"reviewStatus": "accepted"|"rejected", "reviewFeedback": string, "title": string, "summary": string, "callsToAction": [], "confidence": "high"|"medium"|"low"}`;

const reviewPrompt = (band: Band): string =>
  `${REVIEW_RULES}\n\n${BAND_TONE[band]}`;

export interface SeedPrompt {
  name: string;
  description: string;
  content: string;
  model: string;
}

const BANDS: Band[] = ["info", "monitor", "action", "critical"];

export const SEED_PROMPTS: SeedPrompt[] = [
  ...BANDS.map((band) => ({
    name: `official_aws_summarize_${band}`,
    description: `Standardise an official AWS alert (${band} band). Repo-versioned; reseed with npm run seed:prompts.`,
    content: summarisationPrompt(band, true),
    model: "gpt-5-nano",
  })),
  ...BANDS.map((band) => ({
    name: `official_summarize_${band}`,
    description: `Standardise an official non-AWS alert (${band} band). Repo-versioned.`,
    content: summarisationPrompt(band, false),
    model: "gpt-5-nano",
  })),
  ...BANDS.map((band) => ({
    name: `user_report_review_summarize_${band}`,
    description: `Review + standardise a community report (${band} band). Repo-versioned.`,
    content: reviewPrompt(band),
    model: "gpt-5-nano",
  })),
];

/** Config-group name -> prompt-name prefix, matching AIPromptConfiguration. */
export const CONFIG_GROUPS: Record<string, string> = {
  officialAwsAlertSummarizationPromptId: "official_aws_summarize",
  officialAlertSummarizationPromptId: "official_summarize",
  userReportedAlertReviewAndSummarizePromptId: "user_report_review_summarize",
};
