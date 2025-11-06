import type { HazardReviewStatus, HazardSeverity } from "@prisma/client";

export interface SortSetting {
  severity?: "asc" | "desc" | undefined;
  distance?: "asc" | "desc" | undefined;
  createdAt?: "asc" | "desc" | undefined;
  confidenceScore?: "asc" | "desc" | undefined;
}

export type HazardSeverityWithAwsCompliant = {
  aws?: HazardSeverity[] | HazardSeverity | undefined;
  nonAws?: HazardSeverity[] | HazardSeverity | undefined;
};

export interface HazardSearchParams {
  searchString?: string | undefined;
  categoryIds?: string | string[] | undefined;
  severityFilter?: HazardSeverityWithAwsCompliant | undefined;
  reportedById?: string | undefined;
  reviewStatus?: HazardReviewStatus | undefined;

  northeastLat?: number | undefined;
  northeastLng?: number | undefined;
  southwestLat?: number | undefined;
  southwestLng?: number | undefined;

  userLat?: number | undefined;
  userLng?: number | undefined;

  showExpired?: boolean | undefined;

  isAwsCompliant?: boolean | undefined;

  sortSettings?: SortSetting[] | undefined;

  page?: number | undefined;
  pageSize?: number | undefined;
}
