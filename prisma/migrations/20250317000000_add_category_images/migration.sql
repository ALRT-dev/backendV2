-- CreateEnum
CREATE TYPE "CategoryImageType" AS ENUM ('info', 'monitor', 'action', 'critical', 'advice', 'watchAndAct', 'emergency');

-- CreateTable
CREATE TABLE "HazardCategoryImage" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "imageType" "CategoryImageType" NOT NULL,
    "url" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardCategoryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HazardCategoryImage_categoryId_imageType_key" ON "HazardCategoryImage"("categoryId", "imageType");

-- CreateIndex
CREATE INDEX "HazardCategoryImage_categoryId_idx" ON "HazardCategoryImage"("categoryId");

-- AddForeignKey
ALTER TABLE "HazardCategoryImage" ADD CONSTRAINT "HazardCategoryImage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HazardCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
