-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledDeletionAt" TIMESTAMP(3);
