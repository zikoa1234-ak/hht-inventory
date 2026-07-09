-- ============================================================
-- HHT Inventory — Template Delete FK Fix
-- 
-- Problem: positions.template_id FK has no ON DELETE clause,
-- so deleting a template fails when any position references it.
-- 
-- Fix: Make the FK ON DELETE SET NULL so deleting a template
-- clears the reference on existing positions (they keep their
-- own components, which is what the UI already promises).
-- ============================================================

ALTER TABLE positions
  DROP CONSTRAINT IF EXISTS positions_template_id_fkey,
  ALTER COLUMN template_id DROP NOT NULL,
  ADD CONSTRAINT positions_template_id_fkey
    FOREIGN KEY (template_id)
    REFERENCES position_templates(id)
    ON DELETE SET NULL;
