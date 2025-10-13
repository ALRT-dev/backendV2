-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "hazardsDownvotedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hazardsReportedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hazardsUpvotedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hazardsViewedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "xpPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."HazardView" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HazardView_hazardId_idx" ON "public"."HazardView"("hazardId");

-- CreateIndex
CREATE INDEX "HazardView_userId_idx" ON "public"."HazardView"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HazardView_hazardId_userId_key" ON "public"."HazardView"("hazardId", "userId");

-- AddForeignKey
ALTER TABLE "public"."HazardView" ADD CONSTRAINT "HazardView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HazardView" ADD CONSTRAINT "HazardView_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "public"."Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
