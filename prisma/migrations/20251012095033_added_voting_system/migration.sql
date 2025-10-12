-- CreateEnum
CREATE TYPE "public"."HazardVoteType" AS ENUM ('upvote', 'downvote');

-- AlterTable
ALTER TABLE "public"."Hazard" ADD COLUMN     "downvoteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upvoteCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."HazardVote" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."HazardVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HazardVote_hazardId_userId_key" ON "public"."HazardVote"("hazardId", "userId");

-- AddForeignKey
ALTER TABLE "public"."HazardVote" ADD CONSTRAINT "HazardVote_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "public"."Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HazardVote" ADD CONSTRAINT "HazardVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
