-- CreateEnum
CREATE TYPE "public"."FamilyScheduledCheckInMode" AS ENUM ('automatic', 'prompted');

-- CreateTable
CREATE TABLE "public"."FamilyScheduledCheckIn" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "mode" "public"."FamilyScheduledCheckInMode" NOT NULL DEFAULT 'prompted',
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyScheduledCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyScheduledCheckIn_memberId_timeOfDay_key" ON "public"."FamilyScheduledCheckIn"("memberId", "timeOfDay");

-- CreateIndex
CREATE INDEX "FamilyScheduledCheckIn_circleId_idx" ON "public"."FamilyScheduledCheckIn"("circleId");

-- CreateIndex
CREATE INDEX "FamilyScheduledCheckIn_timeOfDay_idx" ON "public"."FamilyScheduledCheckIn"("timeOfDay");

-- AddForeignKey
ALTER TABLE "public"."FamilyScheduledCheckIn" ADD CONSTRAINT "FamilyScheduledCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
