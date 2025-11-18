export interface AIReviewResponse {
  reviewStatus: "accepted" | "rejected";
  reviewFeedback: string;
  title: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  callToAction: string;
}
