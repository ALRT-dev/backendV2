-- CreateEnum
CREATE TYPE "public"."ConfigurationKey" AS ENUM ('aiPrompts');

-- CreateTable
CREATE TABLE "public"."Configuration" (
    "id" TEXT NOT NULL,
    "key" "public"."ConfigurationKey" NOT NULL,
    "value" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Configuration_key_key" ON "public"."Configuration"("key");

-- AddForeignKey
ALTER TABLE "public"."Configuration" ADD CONSTRAINT "Configuration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Configuration" ADD CONSTRAINT "Configuration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
