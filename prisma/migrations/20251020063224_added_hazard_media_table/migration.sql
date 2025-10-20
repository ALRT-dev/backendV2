-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('image', 'video');

-- CreateTable
CREATE TABLE "public"."HazardMedia" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "s3Key" TEXT,
    "type" "public"."MediaType" NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "originalName" TEXT,
    "thumbnailUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HazardMedia_hazardId_idx" ON "public"."HazardMedia"("hazardId");

-- CreateIndex
CREATE INDEX "HazardMedia_userId_idx" ON "public"."HazardMedia"("userId");

-- AddForeignKey
ALTER TABLE "public"."HazardMedia" ADD CONSTRAINT "HazardMedia_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "public"."Hazard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HazardMedia" ADD CONSTRAINT "HazardMedia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
