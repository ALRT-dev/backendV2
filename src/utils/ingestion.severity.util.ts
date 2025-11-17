import { HazardSeverity } from "@prisma/client";

/**
 * Keywords associated with each hazard severity level.
 * These keywords are used to infer severity from hazard descriptions.
 */
export const severityKeywords = {
  [HazardSeverity.emergency]: ["emergency warning"],
  [HazardSeverity.watchAndAct]: ["watch and act"],
  [HazardSeverity.advice]: ["advice"],
  [HazardSeverity.unknown]: ["not applicable"],
  [HazardSeverity.info]: ["info", "information"],
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
      if (desc.includes(keyword)) {
        return severity as HazardSeverity;
      }
    }
  }
  return HazardSeverity.unknown;
};
