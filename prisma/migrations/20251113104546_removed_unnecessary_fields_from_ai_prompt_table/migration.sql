/*
  Warnings:

  - You are about to drop the column `isActive` on the `AIPrompt` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `AIPrompt` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."AIPrompt_isActive_idx";

-- DropIndex
DROP INDEX "public"."AIPrompt_name_isActive_idx";

-- AlterTable
ALTER TABLE "public"."AIPrompt" DROP COLUMN "isActive",
DROP COLUMN "version";
