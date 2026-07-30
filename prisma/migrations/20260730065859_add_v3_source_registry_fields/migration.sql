-- CreateEnum
CREATE TYPE "public"."HazardSourceShape" AS ENUM ('triangle', 'diamond', 'circle', 'square', 'shield');

-- CreateEnum
CREATE TYPE "public"."HazardSeveritySystem" AS ENUM ('awsLevel', 'band', 'category', 'gdacsColour', 'advisory');

-- CreateEnum
CREATE TYPE "public"."SeverityLevelHandling" AS ENUM ('verbatim', 'bandColourOnly', 'categoryColour', 'levelExempt');

-- CreateEnum
CREATE TYPE "public"."SourcePushPolicy" AS ENUM ('everyLevel', 'bandThreshold', 'afterConfirmation', 'greenExempt', 'advisoryOnly');

-- AlterTable
ALTER TABLE "public"."HazardSource" ADD COLUMN     "levelHandling" "public"."SeverityLevelHandling",
ADD COLUMN     "maxInternalBand" "public"."HazardSeverityBand",
ADD COLUMN     "pushPolicy" "public"."SourcePushPolicy",
ADD COLUMN     "severitySystem" "public"."HazardSeveritySystem",
ADD COLUMN     "shape" "public"."HazardSourceShape",
ADD COLUMN     "stickiness" INTEGER;
