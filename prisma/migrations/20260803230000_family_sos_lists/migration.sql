-- CreateTable
CREATE TABLE "public"."FamilySosList" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilySosList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilySosList_ownerUserId_idx" ON "public"."FamilySosList"("ownerUserId");

-- AddForeignKey
ALTER TABLE "public"."FamilySosList" ADD CONSTRAINT "FamilySosList_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
