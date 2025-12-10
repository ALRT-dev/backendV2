-- CreateEnum
CREATE TYPE "public"."OnboardingStep" AS ENUM ('welcome', 'location', 'radius', 'pushNotification', 'tosAcceptance');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "onboardingStep" "public"."OnboardingStep" NOT NULL DEFAULT 'welcome';
