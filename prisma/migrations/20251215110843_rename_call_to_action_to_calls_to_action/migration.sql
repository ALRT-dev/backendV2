/*
 Renames callToAction to callsToAction without data loss.
 */
-- Rename the column
ALTER TABLE "public"."Hazard"
  RENAME COLUMN "callToAction" TO "callsToAction";