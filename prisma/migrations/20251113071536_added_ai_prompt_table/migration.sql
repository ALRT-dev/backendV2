-- CreateTable
CREATE TABLE "public"."AIPrompt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIPrompt_name_key" ON "public"."AIPrompt"("name");

-- CreateIndex
CREATE INDEX "AIPrompt_name_idx" ON "public"."AIPrompt"("name");

-- CreateIndex
CREATE INDEX "AIPrompt_isActive_idx" ON "public"."AIPrompt"("isActive");

-- CreateIndex
CREATE INDEX "AIPrompt_name_isActive_idx" ON "public"."AIPrompt"("name", "isActive");

-- AddForeignKey
ALTER TABLE "public"."AIPrompt" ADD CONSTRAINT "AIPrompt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIPrompt" ADD CONSTRAINT "AIPrompt_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
