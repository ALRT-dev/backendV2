-- AlterTable
ALTER TABLE "public"."FamilyCircle" ADD COLUMN "anyoneCanRequestSnapshot" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sosToWholeGroup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "journeysSnapPointsOnly" BOOLEAN NOT NULL DEFAULT true;
