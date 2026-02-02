-- Delete duplicate isOwnLocation = true entries, keeping the most recent one per user
DELETE FROM "LocationSubscription" a USING "LocationSubscription" b
WHERE a."userId" = b."userId"
  AND a."isOwnLocation" = true
  AND b."isOwnLocation" = true
  AND a."createdAt" < b."createdAt";
-- Create partial unique index: only one isOwnLocation = true per user
-- This allows multiple isOwnLocation = false entries per user
CREATE UNIQUE INDEX "LocationSubscription_userId_ownLocation_unique" ON "LocationSubscription" ("userId")
WHERE "isOwnLocation" = true;