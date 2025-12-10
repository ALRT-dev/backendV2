-- AlterTable
ALTER TABLE "public"."UserPushNotificationSetting" ADD COLUMN     "subscribedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
