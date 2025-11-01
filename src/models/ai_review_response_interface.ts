export interface AIReviewResponse {
  reviewStatus: "accepted" | "rejected";
  reviewFeedback: string;
  title: string;
  shortDescription: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  severity: "info" | "advice" | "watchAndAct" | "emergency";
  callToAction: string;
}
