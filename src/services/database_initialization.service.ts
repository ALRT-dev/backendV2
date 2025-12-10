import { initializeHazardCategories } from "./hazard_category.service.js";
import { initializeAIPrompts } from "./ai-prompt.service.js";
import { initializeDefaultConfigurations } from "./configuration.service.js";
import { activateSuperAdmin } from "./user.admin.service.js";

/**
 * Initialize all database-dependent services and data
 * This function should be called when the server starts
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    await activateSuperAdmin();

    await Promise.all([
      initializeHazardCategories(),
      initializeAIPrompts().then(() => initializeDefaultConfigurations()),
    ]);

    console.log(
      "---------------------------------------> Database initialization completed successfully"
    );
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};
