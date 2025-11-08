-- CreateIndex
CREATE INDEX "Hazard_latitude_longitude_idx" ON "public"."Hazard"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Hazard_categoryId_idx" ON "public"."Hazard"("categoryId");

-- CreateIndex
CREATE INDEX "Hazard_severity_idx" ON "public"."Hazard"("severity");

-- CreateIndex
CREATE INDEX "Hazard_createdAt_idx" ON "public"."Hazard"("createdAt");

-- CreateIndex
CREATE INDEX "Hazard_confidenceScore_idx" ON "public"."Hazard"("confidenceScore");

-- CreateIndex
CREATE INDEX "Hazard_expiresAt_idx" ON "public"."Hazard"("expiresAt");

-- CreateIndex
CREATE INDEX "Hazard_reviewStatus_idx" ON "public"."Hazard"("reviewStatus");

-- CreateIndex
CREATE INDEX "Hazard_reportedById_idx" ON "public"."Hazard"("reportedById");

-- CreateIndex
CREATE INDEX "Hazard_isAwsCompliant_idx" ON "public"."Hazard"("isAwsCompliant");

-- CreateIndex
CREATE INDEX "Hazard_severity_isAwsCompliant_idx" ON "public"."Hazard"("severity", "isAwsCompliant");

-- CreateIndex
CREATE INDEX "Hazard_categoryId_severity_idx" ON "public"."Hazard"("categoryId", "severity");

-- CreateIndex
CREATE INDEX "Hazard_expiresAt_reviewStatus_idx" ON "public"."Hazard"("expiresAt", "reviewStatus");

-- CreateIndex
CREATE INDEX "Hazard_latitude_longitude_severity_idx" ON "public"."Hazard"("latitude", "longitude", "severity");

-- CreateIndex
CREATE INDEX "Hazard_createdAt_confidenceScore_idx" ON "public"."Hazard"("createdAt", "confidenceScore");

-- CreateIndex
CREATE INDEX "Hazard_severity_createdAt_idx" ON "public"."Hazard"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "HazardCategory_parentId_idx" ON "public"."HazardCategory"("parentId");

-- CreateIndex
CREATE INDEX "User_xpPoints_idx" ON "public"."User"("xpPoints");

-- CreateIndex
CREATE INDEX "User_reliabilityScore_idx" ON "public"."User"("reliabilityScore");
