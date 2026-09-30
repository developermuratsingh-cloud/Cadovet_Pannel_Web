-- A pharmacy/inventory desk dispensing stock to a doctor can attach a photo of the physical medicine slip
-- (a handwritten stock-issue note), alongside the usual typed item/quantity/notes — not instead of it.
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS slip_image_url VARCHAR(500);
