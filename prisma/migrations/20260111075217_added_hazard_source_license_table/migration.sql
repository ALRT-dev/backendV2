-- AlterTable
ALTER TABLE "public"."HazardSource" ADD COLUMN     "licenseId" TEXT;

-- CreateTable
CREATE TABLE "public"."HazardSourceLicense" (
    "id" TEXT NOT NULL,
    "badgeText" TEXT NOT NULL,
    "licenseText" TEXT NOT NULL,
    "description" TEXT,
    "link" TEXT,
    "foregroundColor" TEXT,
    "backgroundColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardSourceLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HazardSourceLicense_badgeText_key" ON "public"."HazardSourceLicense"("badgeText");

-- CreateIndex
CREATE INDEX "HazardSourceLicense_badgeText_idx" ON "public"."HazardSourceLicense"("badgeText");

-- AddForeignKey
ALTER TABLE "public"."HazardSource" ADD CONSTRAINT "HazardSource_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "public"."HazardSourceLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
