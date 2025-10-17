-- AlterTable
ALTER TABLE "public"."LocationSubscription" ADD COLUMN     "isOwnLocation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "LocationSubscription_userId_isOwnLocation_idx" ON "public"."LocationSubscription"("userId", "isOwnLocation");
