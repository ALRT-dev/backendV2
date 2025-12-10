/*
  Warnings:

  - You are about to drop the column `aiInstructions` on the `HazardCategory` table. All the data in the column will be lost.
  - You are about to drop the column `callToActions` on the `HazardCategory` table. All the data in the column will be lost.
  - You are about to drop the column `severityKeywords` on the `HazardCategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."HazardCategory" DROP COLUMN "aiInstructions",
DROP COLUMN "callToActions",
DROP COLUMN "severityKeywords",
ADD COLUMN     "keywords" TEXT[];
