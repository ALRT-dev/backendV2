-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "reportedById" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Hazard" ADD CONSTRAINT "Hazard_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
