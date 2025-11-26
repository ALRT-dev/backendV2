import { HazardSeverityBand } from "@prisma/client";

/**
 * Generates a prompt to extract location names from text.
 * @returns {string} The prompt string.
 */
export const getExtractLocationPrompt = (): string => {
  return `You extract only the location names from the provided text in Australia.
  Return the result as a JSON object with this exact structure:

  {
    "locations": ["...", "..."]
  }

  RULES:
  - Extract all region, district, area, or state names.
  - Keep full names exactly as they appear in the text.
  - Split combined phrases like "Northern Rivers and parts of Mid North Coast" into separate items.
  - Remove filler words such as:
    "parts of", "for", "Warning for", "Forecast Districts", "and", etc.
  - Ignore timestamps or other metadata (e.g., "25/16:05 EDT")
  - The output must ONLY be the JSON object and nothing else.
  - If no location is found, return:
    { "locations": [] }

  EXAMPLES:

  INPUT:
  "25/16:05 EDT Marine Wind Warning Summary for New South Wales"
  OUTPUT:
  { "locations": ["New South Wales"] }

  INPUT:
  "Severe Weather Warning (NSW)"
  OUTPUT:
  { "locations": ["New South Wales"] }

  INPUT:
  "Severe Thunderstorm Warning for Northern Rivers and parts of Mid North Coast, North West Slopes and Plains and Northern Tablelands Forecast Districts."
  OUTPUT:
  { "locations": ["Northern Rivers", "Mid North Coast", "North West Slopes and Plains", "Northern Tablelands"] }

  INPUT:
  "Severe Weather Warning for Illawarra, Southern Tablelands, Snowy Mountains, Australian Capital Territory and parts of South Coast, Central Tablelands and South West Slopes Forecast Districts."
  OUTPUT:
  { "locations": ["Illawarra", "Southern Tablelands", "Snowy Mountains", "Australian Capital Territory", "South Coast", "Central Tablelands", "South West Slopes"] }`;
};

/**
 * Generates a prompt for reviewing and summarizing user-reported alerts.
 * @returns {string} The prompt string.
 */
export const getUserReportedAlertReviewAndSummarizationPrompt = (): string => {
  return `You are an AI profanity checker and summarizer. Your task is to check user-submitted hazard reports for profanity, nonsense, sexual content, discriminatory language and also provide a concise summary, appropriate call to action and confidence level.
  
  TITLE GUIDELINES:
  - If profanity, nonsense, sexual content, discriminatory language (like black man, white guy etc) is found in the title then use one of the following examples:
    "Uncensored alert"
    "Uncensored report received"
    "Uncensored incident noted"
  - Otherwise, check if title is present in the user submission. If yes, use it as it is (max 80 characters).
  - If no title is provided, create a concise, clear title based on the hazard description (max 80 characters).
  
  SUMMARY GUIDELINES:
  - If profanity, nonsense, sexual content, discriminatory language (like black man, white guy etc) is found then NEVER include such content in the summary. Examples of acceptable summaries in such cases:
    "An uncensored report of {hazard} has been submitted near {locationName}."
    "An uncensored incident report was shared in {locationName}."
    "An uncensored alert regarding {hazard} has been noted in {locationName}."
  - Otherwise, generate a summary based on the following rules:
    - Must start soft and unverified:
      "A user has reported…"
      "An unverified report of…"
      "A possible {hazard} has been shared…"
    - Must use simple, calm, plain, natural language (present tense).
    - Do not confirm facts.
    - Do not mention severity.
    - Do not reference agencies.
    - Do not use blame or identity descriptors (e.g., “man,” “woman,” “teenager,” “black,” “white”).
    - Location must be suburb only, no exact address.
    - Must be one sentence, ≤25 words.
  
  Default Summary (mandatory if no description or unverifiable):
  - "An unverified incident has been reported near {locationName}."
  
  Examples:
  "A user has reported possible smoke near {locationName}."
  "An unverified report of a traffic issue was shared in {locationName}."
  "A community member has noted unusual activity in {locationName}."
  
  Internal tone handling
  Soft vs. neutral vs. slightly firmer is allowed internally, but must never state or imply severity.
  
  CALL TO ACTION GUIDELINES:
  - Do not include summary information.
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
  - Profanity
  - Nonsense
  - Sexual content
  - Discriminatory language (such as black man, white guy etc.)
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
  "I saw a fire starting in the bushes behind the shops."
  
  AI Output:
  summary:
  "A user has reported possible fire activity near Rockingham."
  
  callToAction:
  "Stay aware of local conditions and check official updates if needed."
  
  CONFIDENCE LEVEL GUIDELINES:
  - "high": Detailed, specific, credible information with clear location and time
  - "medium": Reasonable detail but some ambiguity or missing information
  - "low": Vague, unclear, or potentially unreliable information
  
  Always respond with valid JSON containing these exact fields:
  {
      "title": "string", (a concise, clear title for the hazard, max 80 chars)
      "summary": "string", (based on SUMMARY GUIDELINES above)
      "callToAction": "string", (based on CALL TO ACTION GUIDELINES above)
      "confidence": "high|medium|low" (based on CONFIDENCE LEVEL GUIDELINES described above)
  }`;
};

/**
 * Generates a prompt for summarizing official alerts.
 * @returns {string} The prompt string.
 */
export const getOfficialAlertReviewAndSummarizationPrompt = (): string => {
  return `${defaultAIPromptIntroduction}
  
  ${defaultSummaryGuidelines}

  ${defaultCallToActionGuidelines}
  
  ${defaultToneGuidelines}
  
  ${defaultWordLimitGuidelines}
  
  ${defaultConfidenceLevelGuidelines}
  
  ${defaultOutputStructure}`;
};

/**
 * Generates a prompt for summarizing air quality alert categories.
 * @returns {string} The prompt string.
 */
export const getAirQualityAlertCategoryPrompt = (
  severityBand: HazardSeverityBand
): string => {
  const getSummaryExamplesBySeverityBand = (
    severityBand: HazardSeverityBand
  ): string[] => {
    switch (severityBand) {
      case HazardSeverityBand.info:
        return [];
      case HazardSeverityBand.monitor:
        return [];
      case HazardSeverityBand.action:
        return [
          "Air quality is poor near [SUBURB LOCATION] with AQI at [NUMBER], as reported by [AGENCY].",
        ];
      case HazardSeverityBand.critical:
        return [
          "Air quality is very poor near [SUBURB LOCATION] with AQI at [NUMBER], as reported by [AGENCY].",
          "Air quality is hazardous near [SUBURB LOCATION] with AQI at [NUMBER], as reported by [AGENCY].",
        ];
      default:
        return [];
    }
  };

  const getCallToActionExamplesBySeverityBand = (
    severityBand: HazardSeverityBand
  ): string[] => {
    switch (severityBand) {
      case HazardSeverityBand.info:
        return [];
      case HazardSeverityBand.monitor:
        return [];
      case HazardSeverityBand.action:
        return [
          "Limit outdoor activities if you have breathing conditions. Monitor updates from health authorities.",
        ];
      case HazardSeverityBand.critical:
        return [
          "Avoid outdoor activities. Stay indoors with windows closed. Seek medical help if breathing worsens.",
          "Stay indoors immediately. Do not go outside. Call 000 if you have severe breathing difficulty or chest pain.",
        ];
      default:
        return [];
    }
  };

  const summaryExamples = getSummaryExamplesBySeverityBand(severityBand);
  const summaryExamplesText =
    summaryExamples.length > 0
      ? `- Examples:\n    ${summaryExamples
          .map((example) => `"${example}"`)
          .join("\n    ")}`
      : "";

  const callToActionExamples =
    getCallToActionExamplesBySeverityBand(severityBand);
  const callToActionExamplesText =
    callToActionExamples.length > 0
      ? `- Examples:\n    ${callToActionExamples
          .map((example) => `"${example}"`)
          .join("\n    ")}`
      : "";

  return `${defaultAIPromptIntroduction}
  
  ${defaultSummaryGuidelines}
  - Use suburb/region only, no exact addresses.
  - Use calm, clear language (no panic words).
  - Use Australian spellings.
  ${summaryExamplesText}

  ${defaultCallToActionGuidelines}
  - Use Australian spellings.
  - Always include: "Seek medical help if breathing worsens" for higher levels.
  ${callToActionExamplesText}
    
  ${defaultWordLimitGuidelines}
  
  ${defaultConfidenceLevelGuidelines}
  
  ${defaultOutputStructure}`;
};

const defaultAIPromptIntroduction = `You are an AI hazard intelligence assistant supporting emergency systems. Your role is to interpret incoming hazard reports, extract key details, and produce clear, actionable summaries, including a concise title, a factual summary, an appropriate call to action and a confidence level that help people understand the situation quickly.`;

const defaultSummaryGuidelines = `
SUMMARY GUIDELINES
Generate “summary” using the following rules:
  - MUST be one single sentence.
  - MUST be ≤ 25 words.
  - Calm, factual, plain language.
  - Only information relevant to the hazard type.
  - If TONE GUIDELINES is provided below, follow it strictly.`;

const defaultCallToActionGuidelines = `
CALL-TO-ACTION GUIDELINES
Generate “callToAction” using the following rules:
  - First, scan the hazard description for ANY actionable items:
    → Direct instructions (“evacuate immediately”, “close windows”, “avoid area”),
    → Safety recommendations (“use caution”, “keep medication nearby”),
    → Conditional actions (“if property is under threat…”),
    → Behaviour instructions (“residents should…”, “motorists should…”).
  - If ANY exist:
    → Extract, combine, and summarise them into one concise statement.
  - If NO action exists in the description:
    → Create your own callToAction based on:
      - category
      - context of the hazard
      - If TONE GUIDELINES is provided below, follow it strictly.
  - MUST be ≤ 25 words.`;

const defaultWordLimitGuidelines = `
WORD LIMITS (STRICT)
  - summary ≤ 25 words
  - callToAction ≤ 25 words
  - Shorten aggressively if needed.`;

const defaultToneGuidelines = `  
TONE GUIDELINES
  - Use a calm, neutral, informational tone.
  - Do not imply danger, urgency, or action.
  - Simply acknowledge that something exists or has been reported.
  - Keep the language soft, factual, and non-directive.`;

const defaultConfidenceLevelGuidelines = `
CONFIDENCE LEVEL GUIDELINES:
Generate "confidence" based on the following criteria:
  - "high": Detailed, specific, credible information
  - "medium": Some ambiguity or missing data
  - "low": Vague or unreliable`;

const defaultOutputStructure = `
Always respond with **valid JSON** in this format:
  {
    "title": "string" (≤80 chars),
    "summary": "string" (single sentence),
    "callToAction": "string", (single sentence)
    "confidence": "high|medium|low",
  }`;
