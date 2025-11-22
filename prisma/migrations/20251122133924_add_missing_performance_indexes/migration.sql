-- CreateIndex
CREATE INDEX "Hazard_sourceId_idx" ON "public"."Hazard"("sourceId");

-- CreateIndex
CREATE INDEX "Hazard_isAwsCompliant_severity_expiresAt_idx" ON "public"."Hazard"("isAwsCompliant", "severity", "expiresAt");

-- CreateIndex
CREATE INDEX "Hazard_categoryId_expiresAt_severityBand_idx" ON "public"."Hazard"("categoryId", "expiresAt", "severityBand");

-- CreateIndex
CREATE INDEX "Hazard_reportedById_expiresAt_idx" ON "public"."Hazard"("reportedById", "expiresAt");
