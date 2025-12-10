/*
  Warnings:

  - You are about to drop the column `onboardingStep` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "onboardingStep",
ADD COLUMN     "isOnboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "public"."OnboardingStep";
