-- Add created_at column to position_components
ALTER TABLE position_components
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Backfill created_at from updated_at for existing rows
UPDATE position_components
SET created_at = updated_at
WHERE created_at IS NULL AND updated_at IS NOT NULL;

-- Set created_at to now for any remaining nulls
UPDATE position_components
SET created_at = NOW()
WHERE created_at IS NULL;
