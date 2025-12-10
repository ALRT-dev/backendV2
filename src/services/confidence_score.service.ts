import {
  AIConfidence,
  HazardSeverity,
  type HazardSource,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { calculateUserReportsStatus } from "./user.service.js";
import { UserReportsStatus } from "../enums/user_reports_status_types.js";

/**
 * Extended hazard type for confidence score calculation
 */
export type HazardForConfidenceCalculation = {
  severity: HazardSeverity;
  aiConfidence?: AIConfidence | null;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: Date;
  reportedBy?: {
    xpPoints: number;
    reliabilityScore: number;
  } | null;
  reportsStatus?: UserReportsStatus;
};

/**
 * Calculates the Alert Confidence Score (ACS) for a hazard
 * Uses 6 factors with event-driven recalculation
 *
 * @param hazard - Hazard data for calculation
 * @returns Confidence score (0-100)
 */
export const calculateConfidenceScore = (
  hazard: HazardForConfidenceCalculation
): number => {
  let totalScore = 0;

  // 1. Source Trust (25%)
  let sourceTrustScore = 0;
  if (!hazard.reportedBy) {
    // Official source = 100%
    sourceTrustScore = 1.0;
  } else if (hazard.reportsStatus) {
    // Based on user reports status
    switch (hazard.reportsStatus) {
      case UserReportsStatus.verified:
        sourceTrustScore = 0.85;
        break;
      case UserReportsStatus.emerging:
        sourceTrustScore = 0.65;
        break;
      case UserReportsStatus.unverified:
        sourceTrustScore = 0.35;
        break;
    }
  } else {
    // No source or status = unverified
    sourceTrustScore = 0.35;
  }
  totalScore += sourceTrustScore * 0.25;

  // 2. Confirm Ratio (25%) - Upvotes / (Upvotes + Downvotes)
  let confirmRatioScore = 0.5; // Default neutral score
  const totalVotes = hazard.upvoteCount + hazard.downvoteCount;
  if (totalVotes > 0) {
    confirmRatioScore = hazard.upvoteCount / totalVotes;
  }
  totalScore += confirmRatioScore * 0.25;

  // 3. Reporter Reputation (15%) - Based on XP and reliability
  let reporterReputationScore = 0.5; // Default neutral score
  if (hazard.reportedBy) {
    // Normalize XP score (assuming max reasonable XP is 10000)
    const xpScore = Math.min(hazard.reportedBy.xpPoints / 10000, 1);
    // Reliability score is already between 0-1
    const reliabilityScore = hazard.reportedBy.reliabilityScore;
    // Combine both with equal weight
    reporterReputationScore = (xpScore + reliabilityScore) / 2;
  }
  totalScore += reporterReputationScore * 0.15;

  // 4. Severity (15%) - Emergency = highest confidence
  let severityScore = 0;
  switch (hazard.severity) {
    case HazardSeverity.emergency:
      severityScore = 1.0;
      break;
    case HazardSeverity.watchAndAct:
      severityScore = 0.8;
      break;
    case HazardSeverity.advice:
      severityScore = 0.6;
      break;
    case HazardSeverity.info:
      severityScore = 0.4;
      break;
  }
  totalScore += severityScore * 0.15;

  // 5. Recency (10%) - Newer = higher confidence
  let recencyScore = 0;
  const now = new Date();
  const hazardAge = now.getTime() - hazard.createdAt.getTime();
  const hoursAge = hazardAge / (1000 * 60 * 60);
  // Score decreases over 24 hours (0 hours = 1 score, 24+ hours = 0 score)
  recencyScore = Math.max(0, 1 - hoursAge / 24);
  totalScore += recencyScore * 0.1;

  // 6. AI Validation (10%) - Using aiConfidence
  let aiValidationScore = 0.5; // Default neutral score
  if (hazard.aiConfidence) {
    switch (hazard.aiConfidence) {
      case AIConfidence.high:
        aiValidationScore = 1.0;
        break;
      case AIConfidence.medium:
        aiValidationScore = 0.7;
        break;
      case AIConfidence.low:
        aiValidationScore = 0.4;
        break;
    }
  }
  totalScore += aiValidationScore * 0.1;

  // Return score as integer (0-100)
  return Math.round(totalScore * 100);
};

/**
 * Recalculates the confidence score for a specific hazard
 * Called when hazard data changes (votes, reporter status, etc.)
 */
export const recalculateHazardConfidenceScore = async (
  hazardId: string
): Promise<void> => {
  try {
    // Get the hazard with all necessary data for confidence calculation
    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      include: {
        reportedBy: {
          select: {
            id: true,
            xpPoints: true,
            reliabilityScore: true,
          },
        },
      },
    });

    if (!hazard) {
      throw new Error(`Hazard ${hazardId} not found`);
    }

    // Get reporter status if there's a reporter
    let reportsStatus = undefined;
    if (hazard.reportedById) {
      reportsStatus = await calculateUserReportsStatus(hazard.reportedById);
    }

    // Prepare data for confidence calculation
    const hazardForCalculation = {
      id: hazard.id,
      sourceId: hazard.sourceId,
      severity: hazard.severity,
      aiConfidence: hazard.aiConfidence,
      upvoteCount: hazard.upvoteCount,
      downvoteCount: hazard.downvoteCount,
      createdAt: hazard.createdAt,
      reportedBy: hazard.reportedBy,
      ...(reportsStatus && { reportsStatus }),
    };

    // Calculate new confidence score
    const newConfidenceScore = calculateConfidenceScore(hazardForCalculation);

    // Update the hazard with new confidence score
    await prisma.hazard.update({
      where: { id: hazardId },
      data: {
        confidenceScore: newConfidenceScore,
        confidenceScoreCalculatedAt: new Date(),
      },
    });

    console.log(
      `Updated confidence score for hazard ${hazardId}: ${newConfidenceScore}`
    );
  } catch (error) {
    console.error(
      `Error recalculating confidence score for hazard ${hazardId}:`,
      error
    );
    throw error;
  }
};
