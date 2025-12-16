export interface AISummaryResponse {
  title: string;
  summary: string;
  callsToAction: string[];
  confidence: "high" | "medium" | "low";
}
