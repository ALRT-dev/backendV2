import {
  AIConfidence,
  HazardSeverity,
  HazardReviewStatus,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { sendSocketEventToUsers } from "./socket.service.js";
import { SocketEvent } from "../models/socket_event_types.js";

export interface XpCalculationFactors {
  confidence: AIConfidence;
  severity: HazardSeverity;
  reviewStatus: HazardReviewStatus;
  userReliabilityScore?: number;
}

export interface XpCalculationResult {
  basePoints: number;
  severityMultiplier: number;
  reliabilityModifier: number;
  totalXpPoints: number;
  breakdown: {
    basePoints: string;
    severityBonus: string;
    reliabilityBonus: string;
    finalTotal: string;
  };
}

/**
 * Calculates xpPoints for a hazard report based on AI review and other factors
 *
 * 1. Base points from AI confidence and review status
 * 2. Severity multiplier
 * 3. Reliability score modifier
 *
 * Returns detailed breakdown for transparency
 */
export const calculateXpPoints = (
  factors: XpCalculationFactors
): XpCalculationResult => {
  // Step 1: Base points based on AI confidence and review status
  let basePoints = 0;

  if (factors.reviewStatus === HazardReviewStatus.rejected) {
    basePoints = -2; // Small penalty for rejected reports
  } else if (factors.reviewStatus === HazardReviewStatus.accepted) {
    switch (factors.confidence) {
      case AIConfidence.high:
        basePoints = 20;
        break;
      case AIConfidence.medium:
        basePoints = 12;
        break;
      case AIConfidence.low:
        basePoints = 5;
        break;
      default:
        basePoints = 8; // fallback for accepted reports without confidence
    }
  }

  // Step 2: Severity multiplier
  let severityMultiplier = 1.0;
  switch (factors.severity) {
    case HazardSeverity.emergency:
      severityMultiplier = 2.0;
      break;
    case HazardSeverity.watchAndAct:
      severityMultiplier = 1.5;
      break;
    case HazardSeverity.advice:
      severityMultiplier = 1.2;
      break;
    case HazardSeverity.info:
      severityMultiplier = 1.0;
      break;
  }

  // Step 3: Reliability score modifier
  let reliabilityModifier = 1.0;
  if (factors.userReliabilityScore !== undefined) {
    if (factors.userReliabilityScore >= 0.8) {
      reliabilityModifier = 1.2; // +20% bonus for highly reliable users
    } else if (factors.userReliabilityScore < 0.5) {
      reliabilityModifier = 0.9; // -10% penalty for low reliability users
    }
  }

  // Calculate final score
  const pointsAfterSeverity = basePoints * severityMultiplier;
  const pointsAfterReliability = pointsAfterSeverity * reliabilityModifier;
  const totalXpPoints = Math.round(pointsAfterReliability);

  return {
    basePoints,
    severityMultiplier,
    reliabilityModifier,
    totalXpPoints,
    breakdown: {
      basePoints: `${basePoints} (${factors.confidence} confidence, ${factors.reviewStatus})`,
      severityBonus: `${basePoints} × ${severityMultiplier} = ${Math.round(
        pointsAfterSeverity
      )} (${factors.severity})`,
      reliabilityBonus: `× ${reliabilityModifier} = ${Math.round(
        pointsAfterReliability
      )} (reliability: ${factors.userReliabilityScore?.toFixed(2) || "N/A"})`,
      finalTotal: `${totalXpPoints} total XP points`,
    },
  };
};

/**
 * Awards xpPoints to a user for a hazard report and updates their reliability score
 */
export const awardXpPointsForHazard = async (
  userId: string,
  hazardId: string,
  factors: XpCalculationFactors
): Promise<{
  pointsAwarded: number;
  newXpTotal: number;
  newReliabilityScore: number;
  calculation: XpCalculationResult;
}> => {
  // Get current user stats
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      xpPoints: true,
      reliabilityScore: true,
      _count: {
        select: {
          hazardsReported: true,
        },
      },
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  // Include current reliability score in calculation
  const updatedFactors = {
    ...factors,
    userReliabilityScore: user.reliabilityScore,
  };

  const calculation = calculateXpPoints(updatedFactors);
  const pointsToAward = calculation.totalXpPoints;

  // Update user's xpPoints
  const newXpTotal = user.xpPoints + pointsToAward;

  // Calculate new reliability score based on acceptance rate
  // This is a simplified approach - you might want to make this more sophisticated
  const totalReports = user._count.hazardsReported + 1; // +1 for current report
  let reliabilityAdjustment = 0;

  if (factors.reviewStatus === HazardReviewStatus.accepted) {
    if (factors.confidence === AIConfidence.high) {
      reliabilityAdjustment = 0.05; // Boost for high-quality reports
    } else if (factors.confidence === AIConfidence.medium) {
      reliabilityAdjustment = 0.02;
    }
  } else if (factors.reviewStatus === HazardReviewStatus.rejected) {
    reliabilityAdjustment = -0.03; // Penalty for rejected reports
  }

  // Apply diminishing returns for reliability changes
  const adjustmentFactor = Math.max(0.1, 1 / Math.sqrt(totalReports));
  const finalReliabilityAdjustment = reliabilityAdjustment * adjustmentFactor;

  const newReliabilityScore = Math.max(
    0,
    Math.min(1, user.reliabilityScore + finalReliabilityAdjustment)
  );

  // Update user in database
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      xpPoints: newXpTotal,
      reliabilityScore: newReliabilityScore,
    },
  });

  // Send updated XP and reliability score to the user via socket
  sendSocketEventToUsers({
    userIds: [userId],
    event: SocketEvent.updateUserXp,
    data: {
      userId: updatedUser.id,
      xpPoints: updatedUser.xpPoints,
      reliabilityScore: updatedUser.reliabilityScore,
    },
  });

  console.log(
    `Awarded ${pointsToAward} XP to user ${userId} for hazard ${hazardId}`
  );
  console.log(`Calculation breakdown:`, calculation.breakdown);

  return {
    pointsAwarded: pointsToAward,
    newXpTotal,
    newReliabilityScore,
    calculation,
  };
};
