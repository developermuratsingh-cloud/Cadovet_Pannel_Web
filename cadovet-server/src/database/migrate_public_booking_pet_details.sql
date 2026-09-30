-- Public website booking details captured for the veterinary team.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS age_years NUMERIC(5,2);
ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_aggressive BOOLEAN NOT NULL DEFAULT FALSE;