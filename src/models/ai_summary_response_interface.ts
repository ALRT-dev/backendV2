export interface AISummaryResponse {
  title: string;
  shortDescription: string;
  summary: string;
  callToAction: string;
  confidence: "high" | "medium" | "low";
}
