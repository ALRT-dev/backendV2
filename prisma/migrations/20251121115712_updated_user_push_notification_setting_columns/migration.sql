/*
  Warnings:

  - You are about to drop the column `isEnabled` on the `UserPushNotificationSetting` table. All the data in the column will be lost.
  - You are about to drop the column `settingKey` on the `UserPushNotificationSetting` table. All the data in the column will be lost.
  - You are about to drop the column `settingType` on the `UserPushNotificationSetting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `UserPushNotificationSetting` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."UserPushNotificationSetting_settingType_idx";

-- DropIndex
DROP INDEX "public"."UserPushNotificationSetting_userId_settingType_settingKey_key";

-- AlterTable
ALTER TABLE "public"."UserPushNotificationSetting" DROP COLUMN "isEnabled",
DROP COLUMN "settingKey",
DROP COLUMN "settingType",
ADD COLUMN     "awsAdvice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "awsEmergency" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "awsWatchAndAct" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "officialNonAws" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userReported" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "UserPushNotificationSetting_userId_key" ON "public"."UserPushNotificationSetting"("userId");
