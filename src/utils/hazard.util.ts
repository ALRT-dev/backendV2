import { HazardSeverity } from "@prisma/client";

/**
 * Determines the expiry date for a hazard based on its severity level.
 *
 * Different severity levels correspond to different durations before the hazard is considered expired.
 */
export const getHazardExpiryDateFromSeverity = (
  severity: HazardSeverity
): Date => {
  const now = new Date();

  switch (severity) {
    case HazardSeverity.info:
      now.setHours(now.getHours() + 6); // 6 hours for info
      break;
    case HazardSeverity.advice:
      now.setHours(now.getHours() + 12); // 12 hours for advice
      break;
    case HazardSeverity.watchAndAct:
      now.setHours(now.getHours() + 24); // 24 hours for watchAndAct
      break;
    case HazardSeverity.emergency:
      now.setHours(now.getHours() + 48); // 48 hours for emergency
      break;
    default:
      now.setDate(now.getDate() + 30); // Default to 30 days
  }

  return now;
};

/**
 * Adjusts the expiration time of a hazard by a specified number of milliseconds.
 * If the current expiration time is null, it returns null.
 * If the adjustment results in a past date, it returns null.
 */
export const adjustExpirationTime = (
  currentExpiresAt: Date | null,
  adjustmentMs: number
): Date | null => {
  if (!currentExpiresAt) return null;

  const newExpiresAt = new Date(currentExpiresAt.getTime() + adjustmentMs);
  const now = new Date();

  // Ensure the new expiration time is not in the past
  if (newExpiresAt <= now) {
    // If adjustment would put it in the past, return null
    return null;
  }

  return newExpiresAt;
};

/**
 * Returns a formatted string representation of the hazard severity.
 */
export const getFormattedHazardSeverity = (
  severity: HazardSeverity
): string => {
  switch (severity) {
    case HazardSeverity.info:
      return "Info";
    case HazardSeverity.advice:
      return "Advice";
    case HazardSeverity.watchAndAct:
      return "Watch and Act";
    case HazardSeverity.emergency:
      return "Critical";
    default:
      return "Info";
  }
};
