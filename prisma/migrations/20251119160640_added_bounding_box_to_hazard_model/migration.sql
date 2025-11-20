-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "northeastLat" DOUBLE PRECISION,
ADD COLUMN     "northeastLng" DOUBLE PRECISION,
ADD COLUMN     "southwestLat" DOUBLE PRECISION,
ADD COLUMN     "southwestLng" DOUBLE PRECISION;
