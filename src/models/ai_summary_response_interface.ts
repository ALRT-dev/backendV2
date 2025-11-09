import type { FireStatus, HazardSeverity } from "@prisma/client";

export interface AISummaryResponse {
  title: string;
  shortDescription: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  severity: HazardSeverity;
  callToAction: string;
  category: string;
  fireStatus: FireStatus | null;
}
