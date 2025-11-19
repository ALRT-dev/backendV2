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

/**
 * Map Air Quality Index (AQI) to hazard severity band.
 *
 * @param aqi - The Air Quality Index value.
 * @returns The corresponding HazardSeverityBand.
 */
export const getSeverityBandFromAQI = (aqi: number): HazardSeverityBand => {
  if (aqi >= 0 && aqi <= 50) {
    return HazardSeverityBand.info; // Good
  } else if (aqi >= 51 && aqi <= 100) {
    return HazardSeverityBand.monitor; // Moderate
  } else if (aqi >= 101 && aqi <= 150) {
    return HazardSeverityBand.action; // Unhealthy for Sensitive Groups
  } else if (aqi >= 151 && aqi <= 200) {
    return HazardSeverityBand.critical; // Unhealthy
  } else if (aqi >= 201 && aqi <= 300) {
    return HazardSeverityBand.critical; // Very Unhealthy
  } else if (aqi > 300) {
    return HazardSeverityBand.critical; // Hazardous
  } else {
    return HazardSeverityBand.info; // Default to info for invalid AQI
  }
};

/**
 * Map UV Index to hazard severity band.
 *
 * UV Index Scale:
 * 0-2: Low
 * 3-5: Moderate
 * 6-7: High
 * 8-10: Very High
 * 11+: Extreme
 *
 * @param uvIndex - The UV Index value.
 * @returns The corresponding HazardSeverityBand.
 */
export const getSeverityBandFromUVIndex = (
  uvIndex: number
): HazardSeverityBand => {
  if (uvIndex >= 0 && uvIndex <= 2) {
    return HazardSeverityBand.info; // Low
  } else if (uvIndex >= 3 && uvIndex <= 5) {
    return HazardSeverityBand.monitor; // Moderate
  } else if (uvIndex >= 6 && uvIndex <= 7) {
    return HazardSeverityBand.action; // High
  } else if (uvIndex >= 8 && uvIndex <= 10) {
    return HazardSeverityBand.critical; // Very High
  } else if (uvIndex >= 11) {
    return HazardSeverityBand.critical; // Extreme
  } else {
    return HazardSeverityBand.info; // Default for invalid values
  }
};

/**
 * Map pollen count to hazard severity band.
 *
 * Pollen count categories (grains/m³):
 * 0-30: Low
 * 31-60: Moderate
 * 61-90: High
 * 91+: Very High
 *
 * @param pollenCount - The pollen count value.
 * @returns The corresponding HazardSeverityBand.
 */
export const getSeverityBandFromPollenCount = (
  pollenCount: number
): HazardSeverityBand => {
  if (pollenCount >= 0 && pollenCount <= 30) {
    return HazardSeverityBand.info; // Low
  } else if (pollenCount >= 31 && pollenCount <= 60) {
    return HazardSeverityBand.monitor; // Moderate
  } else if (pollenCount >= 61 && pollenCount <= 90) {
    return HazardSeverityBand.action; // High
  } else if (pollenCount >= 91) {
    return HazardSeverityBand.critical; // Very High
  } else {
    return HazardSeverityBand.info; // Default for invalid values
  }
};
