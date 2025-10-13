import cron from "node-cron";
import { syncHazardsFromRFS } from "./ingestion.service.js";

/**
 * Initializes scheduled tasks for the application
 */
export const initializeScheduledTasks = () => {
  // Full sync every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("Starting scheduled RFS hazard sync...");
    try {
      await syncHazardsFromRFS();
      console.log("Scheduled RFS hazard sync completed successfully");
    } catch (error) {
      console.error("Scheduled RFS hazard sync failed:", error);
    }
  });

  console.log("Scheduled tasks initialized");
};
