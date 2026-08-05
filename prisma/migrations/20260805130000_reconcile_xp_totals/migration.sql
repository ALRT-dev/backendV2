-- Make every user's XP total equal their points history.
--
-- Two awards used to bypass the ledger and write straight onto
-- "User"."xpPoints": onboarding (+20) and, until the previous change, each
-- safety guide. So a user's total and their history disagreed by design,
-- and the weekly quest (which counts guideCompleted rows) could never see
-- guides that were never journalled.
--
-- This backfills the missing events from the records that prove they
-- happened, re-runs the weekly quest against the repaired ledger, and then
-- sets each total to the sum of its own events. After this the total is
-- the history, by construction.
--
-- Every step is guarded by NOT EXISTS, so re-running changes nothing.
-- Separate migration from the one adding 'onboardingCompleted' on purpose:
-- Postgres will not let a new enum value be used in the transaction that
-- created it.

-- 1. Onboarding. Anyone who finished it should have one event, dated to
--    when their account was created.
INSERT INTO "XpEvent" ("id", "userId", "type", "points", "meta", "createdAt")
SELECT
  gen_random_uuid(),
  u."id",
  'onboardingCompleted'::"XpEventType",
  20,
  '{"backfilled": true}'::jsonb,
  u."createdAt"
FROM "User" u
WHERE u."isOnboardingCompleted" = true
  AND NOT EXISTS (
    SELECT 1 FROM "XpEvent" e
    WHERE e."userId" = u."id" AND e."type" = 'onboardingCompleted'
  );

-- 2. Guides. UserGuideProgress is the proof a guide was completed, and it
--    carries the exact XP that was awarded at the time.
INSERT INTO "XpEvent" ("id", "userId", "type", "points", "guideId", "meta", "createdAt")
SELECT
  gen_random_uuid(),
  p."userId",
  'guideCompleted'::"XpEventType",
  p."xpAwarded",
  p."guideId",
  '{"backfilled": true}'::jsonb,
  p."completedAt"
FROM "UserGuideProgress" p
WHERE NOT EXISTS (
    SELECT 1 FROM "XpEvent" e
    WHERE e."userId" = p."userId"
      AND e."type" = 'guideCompleted'
      AND e."guideId" = p."guideId"
  );

-- 3. Weekly quest, re-run against the repaired ledger. Two guides in a
--    Monday-based UTC week earns +20, once per week. date_trunc('week')
--    is Monday-based, matching currentWeekStart() in the service.
--    The event is dated to the guide that completed the quest.
INSERT INTO "XpEvent" ("id", "userId", "type", "points", "meta", "createdAt")
SELECT
  gen_random_uuid(),
  w."userId",
  'questCompleted'::"XpEventType",
  20,
  jsonb_build_object('backfilled', true, 'questId', 'weekly-guides',
                     'week', to_char(w."weekStart", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
  w."earnedAt"
FROM (
  SELECT
    e."userId",
    date_trunc('week', e."createdAt") AS "weekStart",
    COUNT(*) AS "guides",
    -- The moment the second guide landed.
    (ARRAY_AGG(e."createdAt" ORDER BY e."createdAt"))[2] AS "earnedAt"
  FROM "XpEvent" e
  WHERE e."type" = 'guideCompleted'
  GROUP BY e."userId", date_trunc('week', e."createdAt")
) w
WHERE w."guides" >= 2
  AND NOT EXISTS (
    SELECT 1 FROM "XpEvent" q
    WHERE q."userId" = w."userId"
      AND q."type" = 'questCompleted'
      AND date_trunc('week', q."createdAt") = w."weekStart"
  );

-- 4. The total IS the history. Floored at 0 to match recordXpEvent, which
--    never lets a rejection push someone negative.
UPDATE "User" u
SET "xpPoints" = GREATEST(0, COALESCE(s."total", 0))
FROM (
  SELECT "userId", SUM("points")::int AS "total"
  FROM "XpEvent"
  GROUP BY "userId"
) s
WHERE s."userId" = u."id"
  AND u."xpPoints" <> GREATEST(0, COALESCE(s."total", 0));

-- 5. Anyone with no events at all sits at 0, not at some orphaned total.
UPDATE "User" u
SET "xpPoints" = 0
WHERE u."xpPoints" <> 0
  AND NOT EXISTS (SELECT 1 FROM "XpEvent" e WHERE e."userId" = u."id");
