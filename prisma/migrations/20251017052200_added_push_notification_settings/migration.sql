-- CreateTable
CREATE TABLE "public"."UserPushNotificationSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingType" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPushNotificationSetting_userId_idx" ON "public"."UserPushNotificationSetting"("userId");

-- CreateIndex
CREATE INDEX "UserPushNotificationSetting_settingType_idx" ON "public"."UserPushNotificationSetting"("settingType");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushNotificationSetting_userId_settingType_settingKey_key" ON "public"."UserPushNotificationSetting"("userId", "settingType", "settingKey");

-- AddForeignKey
ALTER TABLE "public"."UserPushNotificationSetting" ADD CONSTRAINT "UserPushNotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
