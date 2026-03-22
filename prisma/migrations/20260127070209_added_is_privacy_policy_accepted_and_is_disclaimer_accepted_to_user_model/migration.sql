-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isDisclaimerAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrivacyPolicyAccepted" BOOLEAN NOT NULL DEFAULT false;
