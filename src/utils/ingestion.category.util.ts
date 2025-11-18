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
  const descWords = desc.split(/\s+/);

  const awsCategories = availableCategories.filter((cat) =>
    awsCompliantCategoryIds.includes(cat.id)
  );

  const childCategories = availableCategories.filter(
    (cat) => cat.parent !== null
  );

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

  // Helper function for direct keyword matching (exact word/phrase match)
  const hasDirectMatch = (
    keywords: string[],
    description: string,
    words: string[]
  ): boolean => {
    return keywords.some((keyword) => {
      const lowerKeyword = keyword.toLowerCase().trim();

      // Handle multi-word phrases
      if (lowerKeyword.includes(" ")) {
        // For phrases, check exact phrase match with word boundaries
        const regex = new RegExp(
          `\\b${lowerKeyword.replace(/\s+/g, "\\s+")}\\b`,
          "i"
        );
        return regex.test(description);
      } else {
        // For single words, check exact word match
        return words.includes(lowerKeyword);
      }
    });
  };

  // Helper function for normal keyword matching (substring match)
  const hasNormalMatch = (keywords: string[], description: string): boolean => {
    const lowerKeywords = keywords.map((kw) => kw.toLowerCase());
    return lowerKeywords.some((keyword) => description.includes(keyword));
  };

  // 1. Check AWS categories with direct keyword matching first
  for (const category of awsCategories) {
    if (hasDirectMatch(category.keywords, desc, descWords)) {
      return category;
    }
  }

  // 2. Check AWS categories with normal keyword matching
  for (const category of awsCategories) {
    if (hasNormalMatch(category.keywords, desc)) {
      return category;
    }
  }

  // 3. Check child categories with direct keyword matching
  for (const category of childCategories) {
    if (hasDirectMatch(category.keywords, desc, descWords)) {
      return category;
    }
  }

  // 4. Check parent categories with direct keyword matching
  for (const category of parentCategories) {
    if (hasDirectMatch(category.keywords, desc, descWords)) {
      return category;
    }
  }

  // 5. Check child categories with normal keyword matching
  for (const category of childCategories) {
    if (hasNormalMatch(category.keywords, desc)) {
      return category;
    }
  }

  // 6. Check parent categories with normal keyword matching
  for (const category of parentCategories) {
    if (hasNormalMatch(category.keywords, desc)) {
      return category;
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
