-- Add is_transferred_to_client column to inventory_items table
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_transferred_to_client BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_inventory_transferred_status ON inventory_items(is_transferred_to_client);
