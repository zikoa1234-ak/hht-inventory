-- ============================================================
-- HHT Inventory — Move assigned_person from positions to sites
-- 
-- Reverts the previous migration (assigned_person on positions)
-- and adds it to sites instead. Each site gets a single
-- assigned_person field so the admin can assign a technician
-- to work at that location. A technician can be assigned to
-- multiple sites.
-- ============================================================

ALTER TABLE positions
  DROP COLUMN IF EXISTS assigned_person;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS assigned_person VARCHAR(255);