import { initializeHazardCategories } from "./hazard_category.service.js";
import { initializeAIPrompts, PromptType } from "./ai-prompt.service.js";
import prisma from "../utils/prisma_client.util.js";
import { config } from "../utils/config.js";

/**
 * Initialize all database-dependent services and data
 * This function should be called when the server starts
 */
export const initializeDatabase = async (): Promise<void> => {
  console.log("Starting database initialization...");

  try {
    await Promise.all([initializeHazardCategories(), initializeAIPrompts()]);

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};
