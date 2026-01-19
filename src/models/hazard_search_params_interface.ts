import type { HazardReviewStatus, HazardSeverity } from "@prisma/client";

export interface SortSetting {
  severityBand?: "asc" | "desc" | undefined;
  distance?: "asc" | "desc" | undefined;
  createdAt?: "asc" | "desc" | undefined;
  updatedAt?: "asc" | "desc" | undefined;
  confidenceScore?: "asc" | "desc" | undefined;
}

export type HazardSeverityWithAwsCompliant = {
  aws?: HazardSeverity[] | HazardSeverity | undefined;
  nonAws?: HazardSeverity[] | HazardSeverity | undefined;
};

export interface HazardSearchParams {
  searchString?: string | undefined;
  categoryIds?: string | string[] | undefined;
  sourceIds?: string | string[] | undefined;
  awsEmergency?: boolean | undefined;
  awsWatchAndAct?: boolean | undefined;
  awsAdvice?: boolean | undefined;
  officialNonAws?: boolean | undefined;
  userReported?: boolean | undefined;
  reportedById?: string | undefined;
  reviewStatus?: HazardReviewStatus | undefined;

  northeastLat?: number | undefined;
  northeastLng?: number | undefined;
  southwestLat?: number | undefined;
  southwestLng?: number | undefined;

  ignoreHazardLatLngBounds?: boolean | undefined;

  userLat?: number | undefined;
  userLng?: number | undefined;

  showExpired?: boolean | undefined;

  isAwsCompliant?: boolean | undefined;

  sortSettings?: SortSetting[] | undefined;

  page?: number | undefined;
  pageSize?: number | undefined;
}
