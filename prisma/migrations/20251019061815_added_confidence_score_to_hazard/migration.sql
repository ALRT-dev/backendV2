-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "confidenceScore" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "confidenceScoreCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
