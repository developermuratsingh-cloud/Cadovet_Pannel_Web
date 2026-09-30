-- Multi-location support: branches, staff assigned to one or more branches, and per-branch inventory/appointments.
--
-- Design:
--   * locations            — the physical branches.
--   * user_locations       — many-to-many: a doctor/ops-head/pharmacist/inventory clerk can be rostered at more
--                             than one branch. ADMIN is never scoped by location and has no rows here.
--   * users.active_location_id — which of their assigned branches a staff member is currently working out of.
--                             Read fresh on every request (not baked into the JWT), so switching takes effect
--                             immediately with no re-login. Combined with department_id, this is "the desk":
--                             (active_location_id, department_id) = e.g. "Pharmacy at the Andheri branch".
--   * inventory.location_id (NOT NULL) — stock is per-branch; the same SKU can exist once per location.
--   * inventory_transactions.location_id / inventory_disputes.location_id — denormalized from the inventory item,
--     the same pattern already used for department_id, so lists can filter without an extra join.
--   * appointments.location_id (NOT NULL) — which branch the visit is at.

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(300),
    city VARCHAR(100),
    phone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO locations (name) VALUES ('Main Branch') ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_locations (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_user_locations_location ON user_locations(location_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Backfill: every existing non-customer user is rostered at, and currently working out of, Main Branch.
INSERT INTO user_locations (user_id, location_id)
SELECT u.id, (SELECT id FROM locations WHERE name = 'Main Branch')
FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.name != 'CUSTOMER'
ON CONFLICT DO NOTHING;

UPDATE users SET active_location_id = (SELECT id FROM locations WHERE name = 'Main Branch')
WHERE active_location_id IS NULL
  AND id IN (SELECT user_id FROM user_locations);

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
UPDATE inventory SET location_id = (SELECT id FROM locations WHERE name = 'Main Branch') WHERE location_id IS NULL;
ALTER TABLE inventory ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_sku_key;
ALTER TABLE inventory ADD CONSTRAINT inventory_location_sku_key UNIQUE (location_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);

ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
UPDATE inventory_transactions t SET location_id = i.location_id
FROM inventory i WHERE t.inventory_id = i.id AND t.location_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location ON inventory_transactions(location_id);

ALTER TABLE inventory_disputes ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
UPDATE inventory_disputes d SET location_id = t.location_id
FROM inventory_transactions t WHERE d.transaction_id = t.id AND d.location_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_disputes_location ON inventory_disputes(location_id);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
UPDATE appointments SET location_id = (SELECT id FROM locations WHERE name = 'Main Branch') WHERE location_id IS NULL;
ALTER TABLE appointments ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_location ON appointments(location_id);

-- New permission for managing branches (create/edit/deactivate). Viewing the location list (for switchers and
-- assignment dropdowns) only requires being signed in as staff — see locationRoutes.js.
INSERT INTO permissions (name, description) VALUES ('LOCATION_MANAGE', 'Create, edit and deactivate branch locations')
ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'ADMIN'), (SELECT id FROM permissions WHERE name = 'LOCATION_MANAGE')
ON CONFLICT DO NOTHING;
