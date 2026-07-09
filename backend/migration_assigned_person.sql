-- ============================================================
-- HHT Inventory — Add assigned_person to positions
-- 
-- Adds an assigned_person column to the positions table so
-- admins can assign a person to a position at creation time
-- via the admin-locations page.
-- ============================================================

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS assigned_person VARCHAR(255);