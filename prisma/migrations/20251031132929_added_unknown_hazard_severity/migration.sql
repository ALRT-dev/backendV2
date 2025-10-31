-- AlterEnum
ALTER TYPE "public"."HazardSeverity"
ADD VALUE 'unknown';
-- AlterTable
ALTER TABLE "public"."Hazard"
ALTER COLUMN "severity"
SET DEFAULT 'unknown';