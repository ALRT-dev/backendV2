import { initializeHazardCategories } from "./hazard_category.service.js";

/**
 * Initialize all database-dependent services and data
 * This function should be called when the server starts
 */
export const initializeDatabase = async (): Promise<void> => {
  console.log("Starting database initialization...");

  try {
    // Initialize hazard categories if none exist
    await initializeHazardCategories();

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};
