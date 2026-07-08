import { initializeHazardCategories } from "./hazard_category.service.js";
import { initializeAIPrompts } from "./ai-prompt.service.js";
import { initializeDefaultConfigurations } from "./configuration.service.js";
import { activateSuperAdmin } from "./user.admin.service.js";
import { initializeHazardSources } from "./hazard.service.js";
import { seedSafetyGuides } from "./guide_seed.service.js";

/**
 * Initialize all database-dependent services and data
 * This function should be called when the server starts
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    await activateSuperAdmin();

    await Promise.all([
      initializeHazardSources(),
      initializeHazardCategories(),
      initializeAIPrompts().then(() => initializeDefaultConfigurations()),
    ]);

    // Seed Learn hub safety guides after categories exist (guides map to
    // hazard categories by name). Failures must not block boot.
    try {
      await seedSafetyGuides();
    } catch (error) {
      console.error("❌ Safety guide seeding failed:", error);
    }

    console.log(
      "---------------------------------------> Database initialization completed successfully"
    );
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};
