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
 * First, it prioritizes AWS compliant categories, then child categories,
 * and finally parent categories, using direct keyword matching before normal matching.
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

  // 1. Check AWS categories with direct keyword matching first
  console.log("---> 🧠 Checking AWS categories with direct keyword matching");
  for (const category of awsCategories) {
    if (hasDirectMatch(category.keywords, desc, descWords)) {
      console.log(
        `----> ✅ Direct match found in AWS category: ${category.id}\n`
      );
      return category;
    }
  }
  console.log("---> ❌ No direct match found in AWS categories");

  // 2. Check AWS categories with normal keyword matching
  console.log("---> 🧠 Checking AWS categories with normal keyword matching");
  for (const category of awsCategories) {
    if (hasNormalMatch(category.keywords, desc)) {
      console.log(
        `----> ✅ Normal match found in AWS category: ${category.id}\n`
      );
      return category;
    }
  }
  console.log("---> ❌ No normal match found in AWS categories");

  // 3. Check child categories with direct keyword matching (in main category order)
  console.log("---> 🧠 Checking child categories with direct keyword matching");
  for (const mainCategoryId of mainCategoriesLookupOrder) {
    console.log(
      `----> Checking child categories for main category: ${mainCategoryId}`
    );
    const childrenOfMain = childCategories.filter(
      (cat) => cat.parent?.id === mainCategoryId
    );
    for (const category of childrenOfMain) {
      if (hasDirectMatch(category.keywords, desc, descWords)) {
        console.log(
          `----> ✅ Direct match found in child category: ${category.id}\n`
        );
        return category;
      }
    }
  }
  console.log("---> ❌ No direct match found in child categories");

  // 4. Check parent categories with direct keyword matching (in main category order)
  console.log(
    "---> 🧠 Checking parent categories with direct keyword matching"
  );
  for (const mainCategoryId of mainCategoriesLookupOrder) {
    console.log(
      `----> Checking parent category for main category: ${mainCategoryId}`
    );
    const parentCategory = parentCategories.find(
      (cat) => cat.id === mainCategoryId
    );
    if (
      parentCategory &&
      hasDirectMatch(parentCategory.keywords, desc, descWords)
    ) {
      console.log(
        `----> ✅ Direct match found in parent category: ${parentCategory.id}\n`
      );
      return parentCategory;
    }
  }
  console.log("---> ❌ No direct match found in parent categories");

  // 5. Check child categories with normal keyword matching (in main category order)
  console.log("---> 🧠 Checking child categories with normal keyword matching");
  for (const mainCategoryId of mainCategoriesLookupOrder) {
    console.log(
      `----> Checking child categories for main category: ${mainCategoryId}`
    );
    const childrenOfMain = childCategories.filter(
      (cat) => cat.parent?.id === mainCategoryId
    );
    for (const category of childrenOfMain) {
      if (hasNormalMatch(category.keywords, desc)) {
        console.log(
          `----> ✅ Normal match found in child category: ${category.id}\n`
        );
        return category;
      }
    }
  }
  console.log("---> ❌ No normal match found in child categories");

  // 6. Check parent categories with normal keyword matching (in main category order)
  console.log(
    "---> 🧠 Checking parent categories with normal keyword matching"
  );
  for (const mainCategoryId of mainCategoriesLookupOrder) {
    console.log(
      `----> Checking parent category for main category: ${mainCategoryId}`
    );
    const parentCategory = parentCategories.find(
      (cat) => cat.id === mainCategoryId
    );
    if (parentCategory && hasNormalMatch(parentCategory.keywords, desc)) {
      console.log(
        `----> ✅ Normal match found in parent category: ${parentCategory.id}\n`
      );
      return parentCategory;
    }
  }
  console.log("---> ❌ No normal match found in parent categories");

  // 7. No match found, check child categories for fallback category
  console.log(
    `---> 🧠 Checking child categories for fallback category: ${fallbackCategoryId}`
  );
  const fallbackCategory = childCategories.find(
    (cat) => cat.id === fallbackCategoryId
  );
  if (fallbackCategory) {
    console.log(`----> ✅ Fallback category found: ${fallbackCategory.id}\n`);
    return fallbackCategory;
  }
  console.log("---> ❌ No fallback category found in child categories");

  // 8. No match found, check parent categories for fallback category
  console.log(
    `---> 🧠 Checking parent categories for fallback category: ${fallbackCategoryId}`
  );
  const fallbackCategoryParent = parentCategories.find(
    (cat) => cat.id === fallbackCategoryId
  );
  if (fallbackCategoryParent) {
    console.log(
      `----> ✅ Fallback category found: ${fallbackCategoryParent.id}\n`
    );
    return fallbackCategoryParent;
  }
  console.log("---> ❌ No fallback category found in parent categories");

  // 9. Final fallback to "other" category
  console.log(
    "---> ✅ No match found in any category, defaulting to 'other' category\n"
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
