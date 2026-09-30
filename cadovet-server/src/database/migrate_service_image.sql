-- A service created from the admin Services & Fees page had no photo of its own, so the public site guessed
-- one from the service's name/category. Add a real image URL the operational head/admin can set per service,
-- so it shows correctly in the cart, the best-sellers strip, and the product detail page.
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
