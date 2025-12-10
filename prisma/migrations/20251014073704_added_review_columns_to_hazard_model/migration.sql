/*
  Warnings:

  - You are about to drop the column `aiFeedback` on the `Hazard` table. All the data in the column will be lost.
  - You are about to drop the column `visibility` on the `Hazard` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."HazardReviewStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- AlterTable
ALTER TABLE "public"."Hazard" DROP COLUMN "aiFeedback",
DROP COLUMN "visibility",
ADD COLUMN     "reviewFeedback" TEXT,
ADD COLUMN     "reviewStatus" "public"."HazardReviewStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;
