import type { HazardSeverity } from "@prisma/client";

export type SeverityKeywords = {
  [severityLevel in HazardSeverity]: string[];
};
