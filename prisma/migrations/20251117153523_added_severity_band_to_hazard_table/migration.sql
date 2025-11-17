/*
  Warnings:

  - You are about to drop the column `aiSeverity` on the `Hazard` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."HazardSeverityBand" AS ENUM ('info', 'monitor', 'action', 'critical');

-- AlterTable
ALTER TABLE "public"."Hazard" DROP COLUMN "aiSeverity",
ADD COLUMN     "severityBand" "public"."HazardSeverityBand" NOT NULL DEFAULT 'info';
