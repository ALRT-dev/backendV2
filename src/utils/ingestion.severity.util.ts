import { HazardSeverity, HazardSeverityBand } from "@prisma/client";

/**
 * Keywords associated with each hazard severity level.
 * These keywords are used to infer severity from hazard descriptions.
 */
export const severityKeywords = {
  [HazardSeverity.emergency]: ["emergency warning"],
  [HazardSeverity.watchAndAct]: ["watch and act"],
  [HazardSeverity.advice]: ["advice"],
  [HazardSeverity.unknown]: ["not applicable"],

  // Always keep info last to avoid false positives (e.g., "information" in "emergency warning")
  [HazardSeverity.info]: ["info", "information"],
};

/**
 * Keywords associated with each hazard severity band.
 * These keywords are used to infer severity band from hazard descriptions.
 */
export const severityBandKeywords = {
  [HazardSeverityBand.critical]: [
    "emergency warning",
    "life-threatening",
    "life threatening",
    "threat to life",
    "leave immediately",
    "evacuate immediately",
    "take shelter now",
    "shelter immediately",
    "dangerous to life",
    "act immediately",
    "extreme danger",
    "immediate danger",
    "you are in danger",
    "seek immediate shelter",
    "this is an emergency",
    "catastrophic",
    "major emergency",
    "immediate evacuation",
    "cannot be controlled",
  ],
  [HazardSeverityBand.action]: [
    "take action",
    "act now",
    "prepare now",
    "avoid the area",
    "seek shelter",
    "move to safety",
    "follow instructions",
    "close doors and windows",
    "prepare to leave",
    "disruption expected",
    "significant disruption",
    "major disruption",
    "dangerous conditions",
    "unsafe conditions",
    "hazardous conditions",
    "do not enter",
    "do not travel",
    "road closed",
    "evacuate when prompted",
    "follow official advice",
    "protect property",
    "secure belongings",
  ],
  [HazardSeverityBand.monitor]: [
    "monitor conditions",
    "stay informed",
    "keep up to date",
    "keep an eye",
    "expect delays",
    "possible disruption",
    "minor disruption",
    "reduced visibility",
    "hazard present",
    "ongoing incident",
    "use caution",
    "proceed with caution",
    "take care",
    "plan ahead",
    "allow extra time",
    "slow moving hazard",
    "changing conditions",
    "forecast to worsen",
    "be prepared",
    "monitor advice",
  ],
};

/**
 * The severities that comply with AWS guidelines.
 */
export const awsCompliantSeverities: HazardSeverity[] = [
  HazardSeverity.advice,
  HazardSeverity.watchAndAct,
  HazardSeverity.emergency,
];

/**
 * Determine hazard severity based on description keywords.
 *
 * @param description - The hazard description text.
 * @returns The matched HazardSeverity or "unknown" if no match is found.
 */
export const getSeverityFromDescription = (
  description: string
): HazardSeverity => {
  const desc = description.toLowerCase();
  for (const [severity, keywords] of Object.entries(severityKeywords)) {
    for (const keyword of keywords) {
      if (
        desc.includes(keyword.toLowerCase()) &&
        !desc.includes(`${keyword.toLowerCase()}:`)
      ) {
        return severity as HazardSeverity;
      }
    }
  }
  return HazardSeverity.unknown;
};

/**
 * Map AWS compliant severity to severity band.
 *
 * @param severity - The AWS compliant hazard severity.
 * @returns The corresponding HazardSeverityBand.
 * @throws Error if the severity is not AWS compliant.
 */
export const getSeverityBandFromAWSCompliantSeverity = (
  severity: HazardSeverity
): HazardSeverityBand => {
  if (!awsCompliantSeverities.includes(severity)) {
    throw new Error(`Severity ${severity} is not AWS compliant.`);
  }
  switch (severity) {
    case HazardSeverity.advice:
      return HazardSeverityBand.info;
    case HazardSeverity.watchAndAct:
      return HazardSeverityBand.action;
    case HazardSeverity.emergency:
      return HazardSeverityBand.critical;
    default:
      return HazardSeverityBand.info;
  }
};

/**
 * Determine hazard severity band based on description keywords.
 *
 * @param description - The hazard description text.
 * @returns The matched HazardSeverityBand or "info" if no match is found.
 */
export const getSeverityBandFromDescription = (
  description: string
): HazardSeverityBand => {
  const desc = description.toLowerCase();
  for (const [severityBand, keywords] of Object.entries(severityBandKeywords)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword.toLowerCase())) {
        return severityBand as HazardSeverityBand;
      }
    }
  }
  return HazardSeverityBand.info;
};
