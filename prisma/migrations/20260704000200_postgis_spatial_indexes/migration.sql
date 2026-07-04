-- PostGIS spatial indexing.
--
-- The app previously computed ST_MakePoint(longitude, latitude) per row in
-- every geo query, which can never use an index. These generated columns are
-- kept in sync by Postgres itself and are backed by GiST indexes, so
-- ST_Intersects / ST_DWithin / ST_Distance become index-assisted.
--
-- NOTE: these columns are declared as `Unsupported("geometry(...)")` in
-- schema.prisma. Prisma does not track the GENERATED ALWAYS expression; do
-- not recreate them via `prisma migrate dev --create-only` diffs.

-- Hazard point geometry
ALTER TABLE "Hazard"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "Hazard_geom_idx"
  ON "Hazard" USING GIST ("geom");

-- Hazard coverage-area geometry (bounding-box hazards)
ALTER TABLE "Hazard"
  ADD COLUMN IF NOT EXISTS "geomBox" geometry(Polygon, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "southwestLng" IS NOT NULL AND "southwestLat" IS NOT NULL
       AND "northeastLng" IS NOT NULL AND "northeastLat" IS NOT NULL
        THEN ST_MakeEnvelope("southwestLng", "southwestLat", "northeastLng", "northeastLat", 4326)
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "Hazard_geomBox_idx"
  ON "Hazard" USING GIST ("geomBox");

-- Location subscription bounding-box geometry
ALTER TABLE "LocationSubscription"
  ADD COLUMN IF NOT EXISTS "geomBox" geometry(Polygon, 4326)
  GENERATED ALWAYS AS (
    ST_MakeEnvelope("southwestLng", "southwestLat", "northeastLng", "northeastLat", 4326)
  ) STORED;

CREATE INDEX IF NOT EXISTS "LocationSubscription_geomBox_idx"
  ON "LocationSubscription" USING GIST ("geomBox");

-- Family member live-location geometry (hazard-proximity matching)
ALTER TABLE "FamilyMember"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "FamilyMember_geom_idx"
  ON "FamilyMember" USING GIST ("geom");
