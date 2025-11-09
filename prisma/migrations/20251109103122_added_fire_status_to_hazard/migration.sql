-- CreateEnum
CREATE TYPE "public"."FireStatus" AS ENUM ('active', 'beingControlled', 'underControl', 'closed');

-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "fireStatus" "public"."FireStatus";
