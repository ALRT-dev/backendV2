-- Create a function that automatically updates the geoLocation field
-- when latitude and longitude are inserted or updated
CREATE OR REPLACE FUNCTION update_hazard_geolocation() RETURNS TRIGGER AS $$ BEGIN -- Only update geoLocation if both latitude and longitude are present
  IF NEW.latitude IS NOT NULL
  AND NEW.longitude IS NOT NULL THEN -- Create a PostGIS POINT geometry from longitude and latitude
  -- Note: PostGIS uses (longitude, latitude) order, not (latitude, longitude)
  NEW."geoLocation" = ST_AsText(
    ST_GeomFromText(
      'POINT(' || NEW.longitude || ' ' || NEW.latitude || ')',
      4326 -- WGS84 coordinate system
    )
  );
ELSE -- If either coordinate is NULL, set geoLocation to NULL
NEW."geoLocation" = NULL;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create the trigger that fires before INSERT or UPDATE on the Hazard table
DROP TRIGGER IF EXISTS trigger_update_hazard_geolocation ON "Hazard";
CREATE TRIGGER trigger_update_hazard_geolocation BEFORE
INSERT
  OR
UPDATE ON "Hazard" FOR EACH ROW EXECUTE FUNCTION update_hazard_geolocation();
-- Update existing records to populate geoLocation where missing
-- This ensures any existing hazards get their geoLocation field populated
UPDATE "Hazard"
SET "geoLocation" = ST_AsText(
    ST_GeomFromText(
      'POINT(' || longitude || ' ' || latitude || ')',
      4326
    )
  )
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND (
    "geoLocation" IS NULL
    OR "geoLocation" = ''
  );