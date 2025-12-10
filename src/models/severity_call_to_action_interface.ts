import type { HazardSeverity } from "@prisma/client";

export type SeverityCallToActions = {
  [severityLevel in HazardSeverity]: string[];
};
