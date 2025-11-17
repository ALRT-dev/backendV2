import { FireStatus, type HazardCategory } from "@prisma/client";

/**
 * Keywords associated with each fire status.
 * These keywords are used to infer fire status from hazard descriptions.
 */
export const fireStatusKeywords: Record<FireStatus, string[]> = {
  [FireStatus.active]: [
    "active",
    "going",
    "out of control",
    "escalating",
    "make pumps/alarms",
    "responding",
    "en route",
    "on scene",
    "initial attack",
    "pending",
  ],
  [FireStatus.beingControlled]: [
    "being controlled",
    "contained on some edges",
    "blacking out hotspots",
  ],
  [FireStatus.underControl]: [
    "under control",
    "controlled",
    "contained",
    "extinguished",
    "out",
    "mop up",
    "overhaul",
  ],
  [FireStatus.closed]: [
    "safe",
    "closed",
    "false alarm",
    "not as reported",
    "no incident found",
    "cancelled",
    "extinguished",
    "out",
    "incident closed",
    "all clear",
  ],
};

/**
 * AWS compliant hazard categories.
 * These categories are used to ensure compatibility with AWS.
 */
export const awsCompliantCategoryIds: string[] = [
  "bushfire",
  "cyclone",
  "storm",
  "flood",
  "extremeHeat",
  "damagingWinds",
  "earthquake",
];

/**
 * Determine hazard category based on description keywords.
 *
 * @param description - The hazard description text.
 * @param availableCategories - List of available hazard categories with their keywords.
 * @returns The matched HazardCategory or the "other" category if no match is found.
 */
export const getCategoryFromDescription = (
  description: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[]
): HazardCategory => {
  const desc = description.toLowerCase();

  // Check child categories first
  for (const category of availableCategories) {
    const keywords = category.keywords.map((kw) => kw.toLowerCase());
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return category;
      }
    }
  }

  // Check parent categories if no direct match found in child categories
  const parentCategories =
    availableCategories
      ?.map((cat) => cat.parent)
      ?.filter((cat) => cat !== null)
      .reduce<HazardCategory[]>((acc, curr) => {
        if (curr && !acc.find((c) => c.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []) || [];
  for (const parentCategory of parentCategories) {
    const keywords = parentCategory.keywords.map((kw) => kw.toLowerCase());
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return parentCategory;
      }
    }
  }

  // Default to "other" category if no match found
  return parentCategories.find((cat) => cat.id === "other")!;
};

/**
 * Determine fire status based on description keywords.
 *
 * @param description - The hazard description text.
 * @returns The inferred FireStatus or null if no status could be determined.
 */
export const getFireStatusFromDescription = (
  description: string
): FireStatus | null => {
  const desc = description.toLowerCase();

  for (const [status, keywords] of Object.entries(fireStatusKeywords)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return status as FireStatus;
      }
    }
  }

  return null;
};
