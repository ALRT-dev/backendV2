-- Badges (Points & Badge Logic v1.1 section 3) and the corroboration rows
-- they are counted from.
--
-- XP is unchanged by this migration: corroboration still pays once per
-- report. What was missing is the count of how many people confirmed a
-- report, which is what the corroboration badges are defined on, and which
-- the +10 "widely corroborated" event (already in the XP table, never
-- awarded) also needs.
--
-- Badge definitions stay in code (badge.service.ts) so they are versioned
-- with the repo; only the earning is stored here. Badges are never revoked.

CREATE TABLE IF NOT EXISTS "HazardCorroboration" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "corroboratedByUserId" TEXT NOT NULL,
    "corroboratedByHazardId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardCorroboration_pkey" PRIMARY KEY ("id")
);

-- One person can confirm one report once, however many times they report
-- the same thing nearby.
CREATE UNIQUE INDEX IF NOT EXISTS "HazardCorroboration_hazardId_corroboratedByUserId_key"
    ON "HazardCorroboration"("hazardId", "corroboratedByUserId");
CREATE INDEX IF NOT EXISTS "HazardCorroboration_hazardId_idx"
    ON "HazardCorroboration"("hazardId");
CREATE INDEX IF NOT EXISTS "HazardCorroboration_corroboratedByUserId_idx"
    ON "HazardCorroboration"("corroboratedByUserId");

-- Constraints are added conditionally so a re-run after a partial failure
-- picks up where it stopped instead of erroring on what already applied.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'HazardCorroboration_hazardId_fkey'
    ) THEN
        ALTER TABLE "HazardCorroboration"
            ADD CONSTRAINT "HazardCorroboration_hazardId_fkey"
            FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'HazardCorroboration_corroboratedByUserId_fkey'
    ) THEN
        ALTER TABLE "HazardCorroboration"
            ADD CONSTRAINT "HazardCorroboration_corroboratedByUserId_fkey"
            FOREIGN KEY ("corroboratedByUserId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "progressAtAward" INTEGER,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBadge_userId_badgeId_key"
    ON "UserBadge"("userId", "badgeId");
CREATE INDEX IF NOT EXISTS "UserBadge_userId_earnedAt_idx"
    ON "UserBadge"("userId", "earnedAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserBadge_userId_fkey'
    ) THEN
        ALTER TABLE "UserBadge"
            ADD CONSTRAINT "UserBadge_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill: every corroboration XP event already recorded carries the
-- confirming report in its meta, so the history that exists is preserved
-- rather than starting everyone from zero.
INSERT INTO "HazardCorroboration" (
    "id", "hazardId", "corroboratedByUserId", "corroboratedByHazardId",
    "distanceKm", "createdAt"
)
SELECT
    gen_random_uuid()::text,
    e."hazardId",
    h."reportedById",
    (e."meta" ->> 'corroboratedByHazardId'),
    (e."meta" ->> 'distanceKm')::double precision,
    e."createdAt"
FROM "XpEvent" e
JOIN "Hazard" h ON h."id" = (e."meta" ->> 'corroboratedByHazardId')
WHERE e."type" = 'reportCorroborated'
  AND e."hazardId" IS NOT NULL
  AND e."meta" ->> 'corroboratedByHazardId' IS NOT NULL
  AND h."reportedById" IS NOT NULL
ON CONFLICT ("hazardId", "corroboratedByUserId") DO NOTHING;
