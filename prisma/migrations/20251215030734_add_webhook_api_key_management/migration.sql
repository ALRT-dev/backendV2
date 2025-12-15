-- CreateTable
CREATE TABLE "public"."WebhookApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "keyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 10,
    "maxRequestsPerHour" INTEGER NOT NULL DEFAULT 100,
    "maxRequestsPerDay" INTEGER NOT NULL DEFAULT 1000,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "WebhookApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "reason" TEXT,
    "clientIp" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "requestBody" JSONB,
    "responseTime" INTEGER,
    "hazardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookApiKey_keyHash_key" ON "public"."WebhookApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "WebhookApiKey_keyHash_idx" ON "public"."WebhookApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "WebhookApiKey_isActive_idx" ON "public"."WebhookApiKey"("isActive");

-- CreateIndex
CREATE INDEX "WebhookApiKey_createdAt_idx" ON "public"."WebhookApiKey"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_apiKeyId_idx" ON "public"."WebhookLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "WebhookLog_success_idx" ON "public"."WebhookLog"("success");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "public"."WebhookLog"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_clientIp_idx" ON "public"."WebhookLog"("clientIp");

-- AddForeignKey
ALTER TABLE "public"."WebhookApiKey" ADD CONSTRAINT "WebhookApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookLog" ADD CONSTRAINT "WebhookLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."WebhookApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
