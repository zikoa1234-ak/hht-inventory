-- ============================================================
-- HHT Inventory — Asset Workflow Migration
-- 
-- Adds location/area columns to position_components for the
-- new Location → Area → Asset workflow.
-- 
-- This migration is additive only — no tables are dropped,
-- no existing columns are modified, no data is deleted.
-- ============================================================

-- Step 1: Add new columns to position_components
ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS location VARCHAR(10);

ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS area VARCHAR(50);

ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS asset_name VARCHAR(255);

ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS box VARCHAR(255);

ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS asset_status VARCHAR(50);

-- Step 2: Make position_id nullable (new flat assets don't need a position FK)
ALTER TABLE position_components
  ALTER COLUMN position_id DROP NOT NULL;

-- Step 3: Backfill location and area for EXISTING rows from
--         positions → sites (location) and position_templates (area)
UPDATE position_components pc
SET location = s.name,
    area     = pt.name
FROM positions p
JOIN sites s ON s.id = p.site_id
JOIN position_templates pt ON pt.id = p.template_id
WHERE pc.position_id = p.id
  AND (pc.location IS NULL OR pc.area IS NULL);

-- Step 4: Insert the 18 requested locations as sites
INSERT INTO sites (name) VALUES
  ('CMN'),
  ('RAK'),
  ('AGA'),
  ('TNG'),
  ('FEZ'),
  ('EUN'),
  ('VIL'),
  ('OZZ'),
  ('ESU'),
  ('RBA'),
  ('AHU'),
  ('OUD'),
  ('NDR'),
  ('GLN'),
  ('TTU'),
  ('ERH'),
  ('BEM'),
  ('OZG')
ON CONFLICT (name) DO NOTHING;

-- Step 5: Create catch-all positions for each location+area combo
-- These satisfy the FK constraint for new flat assets that may need a position_id
INSERT INTO positions (site_id, template_id, name)
SELECT st.id, tt.id, st.name || ' - ' || tt.name || ' - Area'
FROM sites st
CROSS JOIN position_templates tt
WHERE st.name IN ('CMN','RAK','AGA','TNG','FEZ','EUN','VIL','OZZ','ESU','RBA','AHU','OUD','NDR','GLN','TTU','ERH','BEM','OZG')
  AND tt.name IN ('Checking','Gate','Back Office')
  AND NOT EXISTS (
    SELECT 1 FROM positions p
    WHERE p.name = st.name || ' - ' || tt.name || ' - Area'
  );

-- Step 6: Add index on (location, area) for fast filtering
CREATE INDEX IF NOT EXISTS idx_position_components_location_area
  ON position_components(location, area);

-- Step 7: Add index on serial_number for duplicate lookups
CREATE INDEX IF NOT EXISTS idx_position_components_serial_number
  ON position_components(serial_number);
