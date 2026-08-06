import type {
  HazardReviewStatus,
  HazardSeverity,
  HazardSeverityBand,
} from "@prisma/client";

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

  /// The id of the user making the request. Used to scope visibility so a
  /// caller only ever sees accepted hazards plus their own reports.
  userId?: string | undefined;

  /// Set by the admin moderation endpoints to bypass the accepted-only
  /// visibility guard so moderators can see pending/rejected reports.
  /// Never set from a user-facing route.
  isAdminRequest?: boolean | undefined;

  severities?: HazardSeverity[] | undefined;
  severityBands?: HazardSeverityBand[] | undefined;

  northeastLat?: number | undefined;
  northeastLng?: number | undefined;
  southwestLat?: number | undefined;
  southwestLng?: number | undefined;

  ignoreHazardLatLngBounds?: boolean | undefined;

  userLat?: number | undefined;
  userLng?: number | undefined;

  showExpired?: boolean | undefined;

  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;

  isAwsCompliant?: boolean | undefined;

  sortSettings?: SortSetting[] | undefined;

  page?: number | undefined;
  pageSize?: number | undefined;
}
