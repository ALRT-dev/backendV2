-- CreateTable
CREATE TABLE "public"."LocationSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "northeastLat" DOUBLE PRECISION NOT NULL,
    "northeastLng" DOUBLE PRECISION NOT NULL,
    "southwestLat" DOUBLE PRECISION NOT NULL,
    "southwestLng" DOUBLE PRECISION NOT NULL,
    "geoRegion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationSubscription_userId_idx" ON "public"."LocationSubscription"("userId");

-- AddForeignKey
ALTER TABLE "public"."LocationSubscription" ADD CONSTRAINT "LocationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
