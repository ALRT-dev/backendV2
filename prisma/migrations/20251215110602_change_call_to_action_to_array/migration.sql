/*
 Safely converts callToAction from TEXT to TEXT[] without data loss.
 Existing string values are converted to single-element arrays.
 */
-- Step 1: Add temporary column for the array
ALTER TABLE "public"."Hazard"
ADD COLUMN "callToAction_new" TEXT [] DEFAULT ARRAY []::TEXT [];
-- Step 2: Migrate existing data - convert non-null strings to single-element arrays
UPDATE "public"."Hazard"
SET "callToAction_new" = ARRAY ["callToAction"::TEXT]
WHERE "callToAction" IS NOT NULL
  AND "callToAction" != '';
-- Step 3: For empty or null values, use empty array
UPDATE "public"."Hazard"
SET "callToAction_new" = ARRAY []::TEXT []
WHERE "callToAction" IS NULL
  OR "callToAction" = '';
-- Step 4: Drop old column
ALTER TABLE "public"."Hazard" DROP COLUMN "callToAction";
-- Step 5: Rename new column to original name
ALTER TABLE "public"."Hazard"
  RENAME COLUMN "callToAction_new" TO "callToAction";