/*
 Warnings:
 
 - Added the required column `description` to the `Hazard` table without a default value. This is not possible if the table is not empty.
 
 */
-- AlterTable
ALTER TABLE "public"."Hazard"
ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "description" TEXT NOT NULL,
  ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "shortDescription" DROP NOT NULL;