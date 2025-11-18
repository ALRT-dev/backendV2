export interface AISummaryResponse {
  title: string;
  summary: string;
  callToAction: string;
  confidence: "high" | "medium" | "low";
}
