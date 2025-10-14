import cron from "node-cron";
import { syncHazardsFromDifferentSources } from "./ingestion.service.js";

/**
 * Initializes scheduled tasks for the application
 */
export const initializeScheduledTasks = () => {
  console.log("Initializing scheduled tasks...");

  // Schedule a task to run every 5 minutes to sync hazards from sources
  cron.schedule("*/15 * * * *", async () => {
    console.log("Starting scheduled hazards sync...");
    try {
      await syncHazardsFromDifferentSources();
      console.log("Scheduled hazards sync completed successfully");
    } catch (error) {
      console.error("Scheduled hazards sync failed:", error);
    }
  });

  console.log("Scheduled tasks initialized");
};
