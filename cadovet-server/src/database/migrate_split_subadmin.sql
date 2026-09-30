-- Replaces the generic "SUBADMIN" role (disambiguated at runtime by department_id) with two explicit roles,
-- PHARMACY and INVENTORY, so the panel has four clear staff sections: Doctor, Pharmacy, Inventory, Operational
-- Head. Each new role keeps the exact permission set SUBADMIN had (department-based scoping inside the
-- controllers does the actual narrowing, and is unchanged) — only the role name changes, so nobody's access
-- changes as a result of this migration.

INSERT INTO roles (name, description) VALUES
  ('PHARMACY', 'Pharmacy desk — medicines, vaccines and dispensing'),
  ('INVENTORY', 'Inventory desk — general clinic supplies')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'PHARMACY'), permission_id FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'INVENTORY'), permission_id FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN')
ON CONFLICT DO NOTHING;

-- Move every existing SUBADMIN to the role matching their current desk.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'PHARMACY')
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN')
  AND department_id = (SELECT id FROM departments WHERE name = 'MEDICINE');

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'INVENTORY')
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN')
  AND department_id = (SELECT id FROM departments WHERE name = 'INVENTORY');

-- Anything left on SUBADMIN (shouldn't be possible — department_id has always been required at creation — but
-- fail safe rather than leave an orphaned role reference) defaults to Pharmacy; an admin can move them from the
-- Users page.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'PHARMACY')
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN');

-- Now safe: no user references it, and its role_permissions rows cascade-delete with it.
DELETE FROM roles WHERE name = 'SUBADMIN';
