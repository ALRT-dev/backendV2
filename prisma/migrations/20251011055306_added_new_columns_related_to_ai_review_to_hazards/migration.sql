-- CreateEnum
CREATE TYPE "public"."AIConfidence" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "aiConfidence" "public"."AIConfidence",
ADD COLUMN     "aiFeedback" TEXT,
ADD COLUMN     "aiSeverity" "public"."HazardSeverity",
ADD COLUMN     "visibility" BOOLEAN NOT NULL DEFAULT true;
