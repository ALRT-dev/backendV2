-- AlterTable: ALRT+ entitlement fields on User, synced from the RevenueCat webhook
ALTER TABLE "public"."User" ADD COLUMN     "plan" "public"."FamilyPlan" NOT NULL DEFAULT 'free',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "planStore" TEXT,
ADD COLUMN     "planUpdatedAt" TIMESTAMP(3);
