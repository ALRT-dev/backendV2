export interface AIReviewResponse {
  reviewStatus: "accepted" | "rejected";
  reviewFeedback?: string;
  title: string;
  summary: string;
  callToAction: string;
  confidence: "high" | "medium" | "low";
}
