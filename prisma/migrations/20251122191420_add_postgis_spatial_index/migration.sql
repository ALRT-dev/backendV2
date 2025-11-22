-- CreateIndex: PostGIS GIST spatial index for point-based hazards
CREATE INDEX IF NOT EXISTS "Hazard_location_gist_idx" ON "Hazard" 
USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Note: This dramatically improves performance for ST_Intersects queries
