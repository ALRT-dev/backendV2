/*
 Warnings:
 
 - The values [low] on the enum `HazardSeverity` will be removed. If these variants are still used in the database, this will fail.
 
 */
-- First, update all existing records with 'low' severity to 'advice'
-- Based on schema comments: "advice // For AWS: advice ------ For Non-AWS: low"
UPDATE "public"."Hazard"
SET "severity" = 'advice'
WHERE "severity" = 'low';
UPDATE "public"."Hazard"
SET "aiSeverity" = 'advice'
WHERE "aiSeverity" = 'low';
-- AlterEnum
BEGIN;
CREATE TYPE "public"."HazardSeverity_new" AS ENUM (
  'unknown',
  'info',
  'advice',
  'watchAndAct',
  'emergency'
);
ALTER TABLE "public"."Hazard"
ALTER COLUMN "severity" DROP DEFAULT;
ALTER TABLE "public"."Hazard"
ALTER COLUMN "aiSeverity" TYPE "public"."HazardSeverity_new" USING (
    "aiSeverity"::text::"public"."HazardSeverity_new"
  );
ALTER TABLE "public"."Hazard"
ALTER COLUMN "severity" TYPE "public"."HazardSeverity_new" USING ("severity"::text::"public"."HazardSeverity_new");
ALTER TYPE "public"."HazardSeverity"
RENAME TO "HazardSeverity_old";
ALTER TYPE "public"."HazardSeverity_new"
RENAME TO "HazardSeverity";
DROP TYPE "public"."HazardSeverity_old";
ALTER TABLE "public"."Hazard"
ALTER COLUMN "severity"
SET DEFAULT 'unknown';
COMMIT;