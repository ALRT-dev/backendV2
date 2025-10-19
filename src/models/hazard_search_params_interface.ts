import type { HazardReviewStatus } from "@prisma/client";

export interface HazardSearchParams {
  searchString?: string | undefined;
  categoryIds?: string | string[] | undefined;
  reportedById?: string | undefined;
  reviewStatus?: HazardReviewStatus | undefined;

  northeastLat?: number | undefined;
  northeastLng?: number | undefined;
  southwestLat?: number | undefined;
  southwestLng?: number | undefined;

  userLat?: number | undefined;
  userLng?: number | undefined;

  showExpired?: boolean | undefined;

  page?: number | undefined;
  pageSize?: number | undefined;
}
