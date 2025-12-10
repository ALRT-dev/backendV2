/*
  Warnings:

  - You are about to drop the column `locationSubscriptionRadiusKm` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "locationSubscriptionRadiusKm",
ADD COLUMN     "ownLocationSubscriptionRadiusKm" INTEGER NOT NULL DEFAULT 5;
