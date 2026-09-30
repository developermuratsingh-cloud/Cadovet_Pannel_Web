-- Full sync of the Services & Fees admin table with the real public catalog (cadovetCatalog.js), so what
-- Operational Head/Admin manage in the panel is what the website actually shows, not a separate hardcoded
-- copy. Adds a slug (stable identity for the public /product/:slug route) and widens the category taxonomy
-- to the site's real sections (Dogs, Cats, Surgery are new; the old generic "Vaccination" bucket is retired
-- in favor of the species-specific Dogs/Cats split the real dogs-packages/cat-packages pages use).
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug VARCHAR(200);
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_slug ON services(slug) WHERE slug IS NOT NULL;
