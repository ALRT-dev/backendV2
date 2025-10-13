/*
  Warnings:

  - You are about to drop the column `hazardsDownvotedCount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `hazardsReportedCount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `hazardsUpvotedCount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `hazardsViewedCount` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."HazardView" DROP CONSTRAINT "HazardView_hazardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."HazardVote" DROP CONSTRAINT "HazardVote_hazardId_fkey";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "hazardsDownvotedCount",
DROP COLUMN "hazardsReportedCount",
DROP COLUMN "hazardsUpvotedCount",
DROP COLUMN "hazardsViewedCount";

-- AddForeignKey
ALTER TABLE "public"."HazardVote" ADD CONSTRAINT "HazardVote_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "public"."Hazard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HazardView" ADD CONSTRAINT "HazardView_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "public"."Hazard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
