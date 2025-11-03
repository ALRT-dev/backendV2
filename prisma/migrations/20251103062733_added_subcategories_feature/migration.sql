-- AlterTable
ALTER TABLE "public"."HazardCategory" ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."HazardCategory" ADD CONSTRAINT "HazardCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."HazardCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
