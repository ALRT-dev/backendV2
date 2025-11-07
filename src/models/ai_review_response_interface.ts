export interface AIReviewResponse {
  reviewStatus: "accepted" | "rejected";
  reviewFeedback: string;
  title: string;
  shortDescription: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  callToAction: string;
}
