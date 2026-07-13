-- ============================================================
-- HHT Inventory — Item Category Migration
-- 
-- Adds item_category column to position_components to support
-- the new 3-card selection flow: spare, position, switch_router.
-- 
-- Existing records get 'position' as the default value for
-- backward compatibility.
-- ============================================================

-- Step 1: Add item_category column with default 'position'
ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS item_category VARCHAR(50) NOT NULL DEFAULT 'position';

-- Step 2: Add index on item_category for fast filtering
CREATE INDEX IF NOT EXISTS idx_position_components_item_category
  ON position_components(item_category);