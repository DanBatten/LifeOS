-- Migration: Add image URL to running shoes
-- Allows storing shoe product images for UI display

ALTER TABLE running_shoes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN running_shoes.image_url IS 'URL or path to shoe product image for display in UI';

