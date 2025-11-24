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
    "life-threatening",
    "life threatening",
    "life-threatening conditions",
    "threat to life",
    "serious threat to life",
    "extreme danger",
    "very dangerous situation",
    "dangerous conditions",
    "severe and dangerous conditions",
    "catastrophic conditions",
    "you are in danger",
    "you may be in danger",
    "you are at risk",
    "you may be at risk",
    "your life may be at risk",
    "immediate threat",
    "immediate danger",
    "immediate risk",
    "emergency situation",
    "emergency conditions",
    "act now",
    "you must act now",
    "act immediately",
    "leave immediately",
    "evacuate immediately",
    "evacuate now",
    "leave now",
    "leave the area now",
    "it is too late to leave",
    "it may be too late to leave",
    "do not return to the area",
    "do not go back into the area",
    "seek shelter immediately",
    "take shelter immediately",
    "shelter in place",
    "stay inside and away from windows",
    "stay indoors and away from windows",
    "stay indoors until further notice",
    "stay where you are until further notice",
    "do not go outside",
    "do not travel to this area",
    "do not enter this area",
    "do not come to this area",
    "keep away from the area",
    "keep well away from the area",
    "keep away from fallen powerlines",
    "keep away from damaged buildings",
    "keep away from the shoreline",
    "stay out of the water",
    "stay out of the surf",
    "follow emergency instructions immediately",
    "follow emergency directions immediately",
  ],
  [HazardSeverityBand.action]: [
    "take precautions",
    "take extra care",
    "take care on the roads",
    "take care in the area",
    "avoid the area",
    "avoid this area",
    "avoid travel in the area",
    "avoid unnecessary travel",
    "delay non-essential travel",
    "postpone travel if possible",
    "delay your journey if you can",
    "use an alternative route",
    "use alternative routes",
    "expect significant delays",
    "do not drive through floodwater",
    "do not enter floodwater",
    "do not walk through floodwater",
    "do not swim in this area",
    "do not enter the water",
    "secure loose items",
    "tie down loose items",
    "move vehicles under cover",
    "move vehicles to higher ground",
    "move livestock to higher ground",
    "protect your property",
    "prepare your property",
    "prepare now",
    "prepare to leave",
    "prepare to evacuate",
    "make a plan",
    "get your plan ready",
    "be ready to act",
    "get ready to act",
    "follow directions of emergency services",
    "follow instructions from emergency services",
    "follow instructions from authorities",
    "follow official advice",
    "check on family and neighbours",
    "keep children and pets indoors",
    "stay indoors if you can",
    "stay off the roads if possible",
  ],
  [HazardSeverityBand.monitor]: [
    "minor flooding",
    "minor flood",
    "minor impact",
    "low impact",
    "localised flooding",
    "localised impacts",
    "some local impacts",
    "allow extra travel time",
    "expect delays",
    "possible delays",
    "some delays",
    "traffic may be affected",
    "services may be affected",
    "conditions may change",
    "if conditions worsen",
    "if the situation worsens",
    "stay informed in case conditions change",
    "continue to monitor conditions",
    "monitor conditions",
    "monitor the situation",
    "check conditions before you travel",
    "check local conditions",
    "check the latest conditions",
    "monitor official updates",
    "stay across official updates",
    "low risk",
    "lower risk",
    "reduced risk",
    "small impact",
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
  if (aqi <= 50) {
    return HazardSeverityBand.info;
  } else if (aqi >= 51 && aqi <= 100) {
    return HazardSeverityBand.monitor;
  } else if (aqi >= 101 && aqi <= 150) {
    return HazardSeverityBand.action;
  } else if (aqi >= 151 && aqi <= 300) {
    return HazardSeverityBand.critical;
  } else if (aqi > 300) {
    return HazardSeverityBand.critical;
  }
  return HazardSeverityBand.info;
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
