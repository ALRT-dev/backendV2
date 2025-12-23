-- AlterTable
ALTER TABLE "public"."AIPrompt" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "public"."AIPromptGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIPromptGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIPromptGroup_name_key" ON "public"."AIPromptGroup"("name");

-- CreateIndex
CREATE INDEX "AIPromptGroup_name_idx" ON "public"."AIPromptGroup"("name");

-- CreateIndex
CREATE INDEX "AIPrompt_groupId_idx" ON "public"."AIPrompt"("groupId");

-- AddForeignKey
ALTER TABLE "public"."AIPrompt" ADD CONSTRAINT "AIPrompt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."AIPromptGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
