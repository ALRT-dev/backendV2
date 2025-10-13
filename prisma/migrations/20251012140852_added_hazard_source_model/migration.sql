/*
  Warnings:

  - You are about to drop the column `source` on the `Hazard` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Hazard" DROP COLUMN "source",
ADD COLUMN     "sourceId" TEXT;

-- CreateTable
CREATE TABLE "public"."HazardSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HazardSource_url_key" ON "public"."HazardSource"("url");

-- AddForeignKey
ALTER TABLE "public"."Hazard" ADD CONSTRAINT "Hazard_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."HazardSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
