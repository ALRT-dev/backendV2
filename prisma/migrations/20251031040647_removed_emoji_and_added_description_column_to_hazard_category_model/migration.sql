/*
  Warnings:

  - You are about to drop the column `emoji` on the `HazardCategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."HazardCategory" DROP COLUMN "emoji",
ADD COLUMN     "description" TEXT;
