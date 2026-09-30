-- The public catalog pages (Dogs/Cats/Grooming/Lab Tests/Best Selling) show more than the panel's original 5
-- fields — a strikethrough sale price, a rating/review count, a "What's included" bullet list, a short flash
-- badge, and a subtitle line under the title. These move into the Services & Fees table too, so that content
-- is fully panel-managed rather than half database, half hardcoded file.
ALTER TABLE services ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS badge VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 4.9;
ALTER TABLE services ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS inclusions JSONB;
