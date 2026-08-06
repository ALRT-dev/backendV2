import cron from "node-cron";
import { syncHazardsFromDifferentSources } from "./ingestion.service.js";
import { SyncHazardsFromExternalSourceOption } from "../enums/sync_hazards_from_external_source_option_types.js";
import { processScheduledAccountDeletions } from "./user.service.js";
import {
  pruneFamilyLocationPings,
  purgeExpiredFamilyLocationData,
} from "./family_alert.service.js";
import { fireDueScheduledCheckIns } from "./family.service.js";
import { endLapsedJourneys } from "./family_journey.service.js";
import { endLapsedSosEvents } from "./family.service.js";

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

  // Locked spec: expired snapshot coordinates are deleted, not hidden.
  // The event log keeps who/when; no movement data outlives its window.
  cron.schedule("*/5 * * * *", async () => {
    try {
      await purgeExpiredFamilyLocationData();
      // A journey past its stop time ends itself and drops its location,
      // so nothing keeps sharing because a phone went quiet.
      await endLapsedJourneys();
      // Same guarantee for SOS: live share stops at the 4 hour cap even if
      // nobody stands it down by hand.
      await endLapsedSosEvents();
      // Stored location points follow the same rules: gone an hour after
      // they were shared, with only a running SOS trail excepted, and
      // nothing at all past the 4-hour live-share cap. This ran daily,
      // which left expired coordinates on disk for up to another 23 hours.
      await pruneFamilyLocationPings();
    } catch (error) {
      console.error("Expired family location purge failed:", error);
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
