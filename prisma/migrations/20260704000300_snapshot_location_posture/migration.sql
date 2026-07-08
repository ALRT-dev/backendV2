-- CreateEnum
CREATE TYPE "public"."FamilySnapshotSource" AS ENUM ('checkIn', 'request', 'sos', 'manual');

-- CreateEnum
CREATE TYPE "public"."FamilyLocationRequestStatus" AS ENUM ('pending', 'shared', 'declined', 'expired');

-- AlterTable
ALTER TABLE "public"."FamilyMember" ADD COLUMN     "locationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "locationSharedVia" "public"."FamilySnapshotSource";

-- CreateTable
CREATE TABLE "public"."FamilyLocationRequest" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetMemberId" TEXT NOT NULL,
    "status" "public"."FamilyLocationRequestStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyLocationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyLocationRequest_targetMemberId_status_idx" ON "public"."FamilyLocationRequest"("targetMemberId", "status");

-- CreateIndex
CREATE INDEX "FamilyLocationRequest_circleId_createdAt_idx" ON "public"."FamilyLocationRequest"("circleId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."FamilyLocationRequest" ADD CONSTRAINT "FamilyLocationRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyLocationRequest" ADD CONSTRAINT "FamilyLocationRequest_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

