-- CreateEnum
CREATE TYPE "public"."FamilyPlan" AS ENUM ('free', 'plus');

-- CreateEnum
CREATE TYPE "public"."FamilyRole" AS ENUM ('owner', 'adult', 'child');

-- CreateEnum
CREATE TYPE "public"."FamilySharingLevel" AS ENUM ('precise', 'approximate', 'alertsOnly', 'off');

-- CreateEnum
CREATE TYPE "public"."FamilyPlaceIcon" AS ENUM ('home', 'work', 'school', 'heart', 'other');

-- CreateEnum
CREATE TYPE "public"."FamilyPlaceEventType" AS ENUM ('arrived', 'left');

-- CreateEnum
CREATE TYPE "public"."FamilyCheckInStatus" AS ENUM ('safe', 'needsHelp');

-- CreateEnum
CREATE TYPE "public"."FamilySosStatus" AS ENUM ('active', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."FamilySosResponseType" AS ENUM ('seen', 'onMyWay', 'called');

-- CreateTable
CREATE TABLE "public"."FamilyCircle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "public"."FamilyPlan" NOT NULL DEFAULT 'plus',
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyCircle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyMember" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."FamilyRole" NOT NULL DEFAULT 'adult',
    "sharingLevel" "public"."FamilySharingLevel" NOT NULL DEFAULT 'precise',
    "nickname" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationLabel" TEXT,
    "locationUpdatedAt" TIMESTAMP(3),
    "batteryLevel" INTEGER,
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "currentPlaceId" TEXT,
    "lastCheckInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyInvite" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 10,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyLocationPing" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "batteryLevel" INTEGER,
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyLocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyCheckIn" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "public"."FamilyCheckInStatus" NOT NULL DEFAULT 'safe',
    "message" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "requestId" TEXT,
    "hazardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyCheckInRequest" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "hazardId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyCheckInRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilySavedPlace" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" "public"."FamilyPlaceIcon" NOT NULL DEFAULT 'other',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 300,
    "address" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilySavedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyPlaceNotificationPref" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "subjectMemberId" TEXT NOT NULL,
    "notifyArrivals" BOOLEAN NOT NULL DEFAULT true,
    "notifyDepartures" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyPlaceNotificationPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyPlaceEvent" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "public"."FamilyPlaceEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyPlaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilySosEvent" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "public"."FamilySosStatus" NOT NULL DEFAULT 'active',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationLabel" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilySosEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilySosResponse" (
    "id" TEXT NOT NULL,
    "sosEventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "public"."FamilySosResponseType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySosResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyMemberHazardAlert" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMemberHazardAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SafetyGuideTopic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyGuideTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SafetyGuide" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sections" JSONB NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 10,
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserGuideProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGuideProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "public"."FamilyMember"("userId");

-- CreateIndex
CREATE INDEX "FamilyMember_circleId_idx" ON "public"."FamilyMember"("circleId");

-- CreateIndex
CREATE INDEX "FamilyMember_latitude_longitude_idx" ON "public"."FamilyMember"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_circleId_userId_key" ON "public"."FamilyMember"("circleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_code_key" ON "public"."FamilyInvite"("code");

-- CreateIndex
CREATE INDEX "FamilyInvite_circleId_idx" ON "public"."FamilyInvite"("circleId");

-- CreateIndex
CREATE INDEX "FamilyLocationPing_memberId_createdAt_idx" ON "public"."FamilyLocationPing"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyCheckIn_circleId_createdAt_idx" ON "public"."FamilyCheckIn"("circleId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyCheckIn_memberId_createdAt_idx" ON "public"."FamilyCheckIn"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyCheckInRequest_circleId_createdAt_idx" ON "public"."FamilyCheckInRequest"("circleId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilySavedPlace_circleId_idx" ON "public"."FamilySavedPlace"("circleId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyPlaceNotificationPref_placeId_subjectMemberId_key" ON "public"."FamilyPlaceNotificationPref"("placeId", "subjectMemberId");

-- CreateIndex
CREATE INDEX "FamilyPlaceEvent_placeId_createdAt_idx" ON "public"."FamilyPlaceEvent"("placeId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyPlaceEvent_memberId_createdAt_idx" ON "public"."FamilyPlaceEvent"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilySosEvent_circleId_status_idx" ON "public"."FamilySosEvent"("circleId", "status");

-- CreateIndex
CREATE INDEX "FamilySosEvent_memberId_createdAt_idx" ON "public"."FamilySosEvent"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilySosResponse_sosEventId_idx" ON "public"."FamilySosResponse"("sosEventId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySosResponse_sosEventId_memberId_type_key" ON "public"."FamilySosResponse"("sosEventId", "memberId", "type");

-- CreateIndex
CREATE INDEX "FamilyMemberHazardAlert_hazardId_idx" ON "public"."FamilyMemberHazardAlert"("hazardId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMemberHazardAlert_memberId_hazardId_key" ON "public"."FamilyMemberHazardAlert"("memberId", "hazardId");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyGuideTopic_slug_key" ON "public"."SafetyGuideTopic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyGuide_slug_key" ON "public"."SafetyGuide"("slug");

-- CreateIndex
CREATE INDEX "SafetyGuide_topicId_sortOrder_idx" ON "public"."SafetyGuide"("topicId", "sortOrder");

-- CreateIndex
CREATE INDEX "UserGuideProgress_userId_idx" ON "public"."UserGuideProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGuideProgress_userId_guideId_key" ON "public"."UserGuideProgress"("userId", "guideId");

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_currentPlaceId_fkey" FOREIGN KEY ("currentPlaceId") REFERENCES "public"."FamilySavedPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."FamilyCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyInvite" ADD CONSTRAINT "FamilyInvite_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."FamilyCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyLocationPing" ADD CONSTRAINT "FamilyLocationPing_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyCheckIn" ADD CONSTRAINT "FamilyCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyCheckIn" ADD CONSTRAINT "FamilyCheckIn_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."FamilyCheckInRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyCheckInRequest" ADD CONSTRAINT "FamilyCheckInRequest_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."FamilyCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyCheckInRequest" ADD CONSTRAINT "FamilyCheckInRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilySavedPlace" ADD CONSTRAINT "FamilySavedPlace_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."FamilyCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyPlaceNotificationPref" ADD CONSTRAINT "FamilyPlaceNotificationPref_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "public"."FamilySavedPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyPlaceNotificationPref" ADD CONSTRAINT "FamilyPlaceNotificationPref_subjectMemberId_fkey" FOREIGN KEY ("subjectMemberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyPlaceEvent" ADD CONSTRAINT "FamilyPlaceEvent_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "public"."FamilySavedPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyPlaceEvent" ADD CONSTRAINT "FamilyPlaceEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilySosEvent" ADD CONSTRAINT "FamilySosEvent_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "public"."FamilyCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilySosEvent" ADD CONSTRAINT "FamilySosEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilySosResponse" ADD CONSTRAINT "FamilySosResponse_sosEventId_fkey" FOREIGN KEY ("sosEventId") REFERENCES "public"."FamilySosEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilySosResponse" ADD CONSTRAINT "FamilySosResponse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMemberHazardAlert" ADD CONSTRAINT "FamilyMemberHazardAlert_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyGuide" ADD CONSTRAINT "SafetyGuide_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."SafetyGuideTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserGuideProgress" ADD CONSTRAINT "UserGuideProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserGuideProgress" ADD CONSTRAINT "UserGuideProgress_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "public"."SafetyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

