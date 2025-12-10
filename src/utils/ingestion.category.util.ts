import { FireStatus, type HazardCategory } from "@prisma/client";
import { MainCategoryId } from "../services/hazard_category.service.js";

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
 * Main categories in order of priority for lookup.
 */
const mainCategoriesLookupOrder: string[] = [
  MainCategoryId.securityAndCrime,
  MainCategoryId.weatherAndEnvironment,
  MainCategoryId.trafficAndTransport,
  MainCategoryId.utilitiesAndInfrastructure,
  MainCategoryId.healthAndAir,
  MainCategoryId.communityInfo,
  MainCategoryId.other,
];

/**
 * Determine hazard category based on description keywords.
 *
 * Performs direct keyword matching first across AWS, parent, and child categories,
 * keeping track of all matches. Then applies priority rules to select the best match.
 * If no direct matches found, repeats the process with normal keyword matching.
 *
 * @param description - The hazard description text.
 * @param availableCategories - List of available hazard categories with their keywords.
 * @returns The matched HazardCategory or the "other" category if no match is found.
 */
export const getCategoryFromDescription = (
  description: string,
  availableCategories: (HazardCategory & { parent: HazardCategory | null })[],
  fallbackCategoryId: string = "other"
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

  // Helper function to find matches and apply priority rules
  const findCategoryWithPriority = (
    matchType: "direct" | "normal"
  ): HazardCategory | null => {
    const isDirectMatch = matchType === "direct";

    console.log(
      `---> 🧠 Starting ${matchType} keyword matching across all categories`
    );

    const awsMatches: HazardCategory[] = [];
    const parentMatches: HazardCategory[] = [];
    const childMatches: HazardCategory[] = [];

    // 1. Check AWS categories for matches
    console.log(`----> Checking AWS categories`);
    for (const category of awsCategories) {
      const matches = isDirectMatch
        ? hasDirectMatch(category.keywords, desc, descWords)
        : hasNormalMatch(category.keywords, desc);

      if (matches) {
        console.log(`------> ✅ Match found in AWS category: ${category.id}`);
        awsMatches.push(category);
      }
    }

    // 2. Check child categories for matches
    console.log(`----> Checking child categories`);
    for (const category of childCategories) {
      const matches = isDirectMatch
        ? hasDirectMatch(category.keywords, desc, descWords)
        : hasNormalMatch(category.keywords, desc);

      if (matches) {
        console.log(`------> ✅ Match found in child category: ${category.id}`);
        childMatches.push(category);
      }
    }

    // 3. Check parent categories for matches
    console.log(`----> Checking parent categories`);
    for (const category of parentCategories) {
      const matches = isDirectMatch
        ? hasDirectMatch(category.keywords, desc, descWords)
        : hasNormalMatch(category.keywords, desc);

      if (matches) {
        console.log(
          `------> ✅ Match found in parent category: ${category.id}`
        );
        parentMatches.push(category);
      }
    }

    // Count total matches
    const totalMatches =
      awsMatches.length + parentMatches.length + childMatches.length;

    console.log(
      `---> 📊 Total ${matchType} matches: ${totalMatches} (AWS: ${awsMatches.length}, Parent: ${parentMatches.length}, Child: ${childMatches.length})`
    );

    // If no matches found, return null
    if (totalMatches === 0) {
      console.log(`---> ❌ No ${matchType} matches found\n`);
      return null;
    }

    // If only one match found, return it
    if (totalMatches === 1) {
      const singleMatch = awsMatches[0] || parentMatches[0] || childMatches[0];
      console.log(
        `---> ✅ Single ${matchType} match found: ${singleMatch!.id}\n`
      );
      return singleMatch!;
    }

    // Multiple matches found, apply priority rules
    console.log(`---> 🎯 Multiple matches found, applying priority rules`);

    // Priority 1: Return AWS category if there is one
    if (awsMatches.length > 0 && awsMatches[0]) {
      const awsMatch = awsMatches[0];
      console.log(
        `----> ✅ Returning AWS category (highest priority): ${awsMatch.id}\n`
      );
      return awsMatch;
    }

    // Priority 2: Return child category using mainCategoriesLookupOrder
    if (childMatches.length > 0) {
      console.log(
        `----> 🔍 Multiple child matches found, using mainCategoriesLookupOrder`
      );
      for (const mainCategoryId of mainCategoriesLookupOrder) {
        const matchingChild = childMatches.find(
          (cat) => cat.parentId === mainCategoryId
        );
        if (matchingChild) {
          console.log(
            `----> ✅ Returning child category (by priority): ${matchingChild.id}\n`
          );
          return matchingChild;
        }
      }
      // If no match found by priority order, return first child match
      if (childMatches[0]) {
        const firstChild = childMatches[0];
        console.log(
          `----> ✅ Returning first child category: ${firstChild.id}\n`
        );
        return firstChild;
      }
    }

    // Priority 3: Return parent category using mainCategoriesLookupOrder
    if (parentMatches.length > 0) {
      console.log(
        `----> 🔍 Multiple parent matches found, using mainCategoriesLookupOrder`
      );
      for (const mainCategoryId of mainCategoriesLookupOrder) {
        const matchingParent = parentMatches.find(
          (cat) => cat.id === mainCategoryId
        );
        if (matchingParent) {
          console.log(
            `----> ✅ Returning parent category (by priority): ${matchingParent.id}\n`
          );
          return matchingParent;
        }
      }
      // If no match found by priority order, return first parent match
      if (parentMatches[0]) {
        const firstParent = parentMatches[0];
        console.log(
          `----> ✅ Returning first parent category: ${firstParent.id}\n`
        );
        return firstParent;
      }
    }

    return null;
  };

  // Try direct keyword matching first
  const directMatch = findCategoryWithPriority("direct");
  if (directMatch) {
    return directMatch;
  }

  // If no direct match, try normal keyword matching
  const normalMatch = findCategoryWithPriority("normal");
  if (normalMatch) {
    return normalMatch;
  }

  // No matches found at all, use fallback
  console.log(
    `---> 🔍 No matches found, looking for fallback category: ${fallbackCategoryId}`
  );

  // Check child categories for fallback category
  const fallbackCategory = childCategories.find(
    (cat) => cat.id === fallbackCategoryId
  );
  if (fallbackCategory) {
    console.log(`----> ✅ Fallback category found: ${fallbackCategory.id}\n`);
    return fallbackCategory;
  }

  // Check parent categories for fallback category
  const fallbackCategoryParent = parentCategories.find(
    (cat) => cat.id === fallbackCategoryId
  );
  if (fallbackCategoryParent) {
    console.log(
      `----> ✅ Fallback category found: ${fallbackCategoryParent.id}\n`
    );
    return fallbackCategoryParent;
  }

  // Final fallback to "other" category
  console.log(
    "---> ✅ No fallback category found, defaulting to 'other' category\n"
  );
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
