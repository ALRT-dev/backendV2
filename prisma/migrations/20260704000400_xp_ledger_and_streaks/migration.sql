-- CreateEnum
CREATE TYPE "public"."XpEventType" AS ENUM ('reportApproved', 'reportRejected', 'reportCorroborated', 'officialMatch', 'guideCompleted', 'questCompleted', 'shareInstall');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "lastActivityDate" TIMESTAMP(3),
ADD COLUMN     "streakDays" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."XpEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "hazardId" TEXT,
    "guideId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "public"."XpEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XpEvent_userId_type_createdAt_idx" ON "public"."XpEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "XpEvent_hazardId_type_idx" ON "public"."XpEvent"("hazardId", "type");

-- AddForeignKey
ALTER TABLE "public"."XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

