-- ALRT+ subscription entitlement fields on User.
-- Written only by the RevenueCat webhook; the app never sets these.

-- AlterTable
ALTER TABLE "public"."User"
  ADD COLUMN "isPlus"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "plusStore"        TEXT,
  ADD COLUMN "plusProductId"    TEXT,
  ADD COLUMN "plusExpiresAt"    TIMESTAMP(3),
  ADD COLUMN "plusWillRenew"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "plusTrialActive"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "revenueCatUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_revenueCatUserId_key" ON "public"."User"("revenueCatUserId");

-- CreateIndex
CREATE INDEX "User_isPlus_idx" ON "public"."User"("isPlus");
