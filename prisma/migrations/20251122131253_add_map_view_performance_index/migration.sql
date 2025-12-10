-- CreateIndex
CREATE INDEX "Hazard_severityBand_createdAt_confidenceScore_idx" ON "public"."Hazard"("severityBand", "createdAt", "confidenceScore");

-- CreateIndex
CREATE INDEX "Hazard_reviewStatus_expiresAt_severityBand_idx" ON "public"."Hazard"("reviewStatus", "expiresAt", "severityBand");
