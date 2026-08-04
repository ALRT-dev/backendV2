-- Journeys: a trip the traveller chooses to share, always with a hard stop
-- they picked. Snap points by default; live is a per-journey opt-in.
CREATE TYPE "FamilyJourneyStatus" AS ENUM ('active', 'ended');

CREATE TABLE "FamilyJourney" (
  "id"             TEXT NOT NULL,
  "circleId"       TEXT NOT NULL,
  "memberId"       TEXT NOT NULL,
  "status"         "FamilyJourneyStatus" NOT NULL DEFAULT 'active',
  "isLive"         BOOLEAN NOT NULL DEFAULT false,
  "endsAt"         TIMESTAMP(3) NOT NULL,
  "endedAt"        TIMESTAMP(3),
  "grantedMinutes" INTEGER NOT NULL DEFAULT 0,
  "latitude"       DOUBLE PRECISION,
  "longitude"      DOUBLE PRECISION,
  "locationLabel"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyJourneyRecipient" (
  "id"        TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyJourneyRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FamilyJourney_circleId_status_idx" ON "FamilyJourney"("circleId", "status");
CREATE INDEX "FamilyJourney_memberId_createdAt_idx" ON "FamilyJourney"("memberId", "createdAt");
CREATE UNIQUE INDEX "FamilyJourneyRecipient_journeyId_memberId_key" ON "FamilyJourneyRecipient"("journeyId", "memberId");
CREATE INDEX "FamilyJourneyRecipient_memberId_idx" ON "FamilyJourneyRecipient"("memberId");

ALTER TABLE "FamilyJourney" ADD CONSTRAINT "FamilyJourney_circleId_fkey"
  FOREIGN KEY ("circleId") REFERENCES "FamilyCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyJourney" ADD CONSTRAINT "FamilyJourney_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyJourneyRecipient" ADD CONSTRAINT "FamilyJourneyRecipient_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "FamilyJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyJourneyRecipient" ADD CONSTRAINT "FamilyJourneyRecipient_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
