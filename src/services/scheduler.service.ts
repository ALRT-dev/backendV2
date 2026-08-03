import cron from "node-cron";
import { syncHazardsFromDifferentSources } from "./ingestion.service.js";
import { SyncHazardsFromExternalSourceOption } from "../enums/sync_hazards_from_external_source_option_types.js";
import { processScheduledAccountDeletions } from "./user.service.js";
import { pruneFamilyLocationPings } from "./family_alert.service.js";
import { fireDueScheduledCheckIns } from "./family.service.js";

/**
 * Initializes scheduled tasks for the application
 */
export const initializeScheduledTasks = () => {
  console.log("Initializing scheduled tasks...");

  // Schedule a task to run every 15 minutes to sync hazards from sources
  cron.schedule("*/15 * * * *", async () => {
    console.log("Starting scheduled hazards sync...");
    try {
      await syncHazardsFromDifferentSources({
        syncOption: SyncHazardsFromExternalSourceOption.ignoreExisting,
      });
      console.log("Scheduled hazards sync completed successfully");
    } catch (error) {
      console.error("Scheduled hazards sync failed:", error);
    }
  });

  // Schedule a task to run daily at 2:00 AM to process scheduled account deletions
  cron.schedule("0 2 * * *", async () => {
    console.log("Starting scheduled account deletions processing...");
    try {
      const deletedCount = await processScheduledAccountDeletions();
      console.log(
        `Scheduled account deletions completed: ${deletedCount} accounts deleted`
      );
    } catch (error) {
      console.error("Scheduled account deletions processing failed:", error);
    }
  });

  // Prune family live-location history daily at 3:00 AM (24h retention)
  cron.schedule("0 3 * * *", async () => {
    try {
      await pruneFamilyLocationPings();
    } catch (error) {
      console.error("Family location ping pruning failed:", error);
    }
  });

  // Fire due family scheduled check-ins (timeOfDay matching runs per minute)
  cron.schedule("* * * * *", async () => {
    try {
      await fireDueScheduledCheckIns();
    } catch (error) {
      console.error("Scheduled check-in firing failed:", error);
    }
  });

  console.log("Scheduled tasks initialized");
};
