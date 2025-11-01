export interface AISummaryResponse {
  title: string;
  shortDescription: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  severity: "info" | "advice" | "watchAndAct" | "emergency";
  callToAction: string;
  category?: string;
}
