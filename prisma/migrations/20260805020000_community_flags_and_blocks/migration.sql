-- Community safety: user-initiated flagging and blocking.
--
-- The automated side (AI review, media screening) already stops most
-- objectionable content before it publishes. These two tables cover what
-- automation cannot: a person deciding something aimed at them is not
-- acceptable. Both are keyed on internal ids only, so neither stores nor
-- exposes personal information.

CREATE TYPE "HazardFlagReason" AS ENUM (
  'inappropriate',
  'misleading',
  'spam',
  'harassment',
  'other'
);

CREATE TABLE "HazardFlag" (
  "id"        TEXT NOT NULL,
  "hazardId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "reason"    "HazardFlagReason" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HazardFlag_pkey" PRIMARY KEY ("id")
);

-- One flag per person per report: raising it twice is not two opinions.
CREATE UNIQUE INDEX "HazardFlag_hazardId_userId_key"
  ON "HazardFlag"("hazardId", "userId");
CREATE INDEX "HazardFlag_hazardId_idx" ON "HazardFlag"("hazardId");
CREATE INDEX "HazardFlag_createdAt_idx" ON "HazardFlag"("createdAt");

ALTER TABLE "HazardFlag"
  ADD CONSTRAINT "HazardFlag_hazardId_fkey"
  FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HazardFlag"
  ADD CONSTRAINT "HazardFlag_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserBlock" (
  "id"        TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key"
  ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockedId_fkey"
  FOREIGN KEY ("blockedId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
