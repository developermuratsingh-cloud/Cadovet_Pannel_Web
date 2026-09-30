-- Clinic workflow: appointments are requested by customers (app / website) or booked by staff, land with the OPERATIONAL
-- HEAD, who assigns a doctor. A DOCTOR sees only appointments assigned to them.
--
-- 1. Two job-specific roles (departments stay as staff grouping) and one new permission.
INSERT INTO roles (name, description)
SELECT 'OPERATIONAL_HEAD', 'Operational head: receives every appointment request, assigns doctors, registers customers, handles billing'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'OPERATIONAL_HEAD');
INSERT INTO roles (name, description)
SELECT 'DOCTOR', 'Doctor: sees only the appointments assigned to them and their patients'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'DOCTOR');

INSERT INTO permissions (name, description)
SELECT 'APPOINTMENT_ASSIGN', 'Can assign an appointment to a doctor'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'APPOINTMENT_ASSIGN');

-- 2. Permission grants (replaces whatever these roles had, so re-running is safe).
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name IN ('OPERATIONAL_HEAD', 'DOCTOR'));

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.name = 'APPOINTMENT_ASSIGN'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
    'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE', 'APPOINTMENT_CANCEL', 'APPOINTMENT_ASSIGN',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE',
    'PET_VIEW', 'PET_CREATE', 'PET_UPDATE',
    'DOCTOR_VIEW', 'SERVICE_VIEW', 'SERVICE_MANAGE',
    'INVOICE_VIEW', 'INVOICE_MANAGE', 'PAYMENT_VIEW', 'PAYMENT_UPDATE')
WHERE r.name = 'OPERATIONAL_HEAD';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
    'APPOINTMENT_VIEW', 'APPOINTMENT_UPDATE',
    'CUSTOMER_VIEW', 'PET_VIEW',
    'DOCTOR_VIEW', 'SERVICE_VIEW',
    'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_MANAGE',
    'PRESCRIPTION_VIEW', 'PRESCRIPTION_CREATE', 'PRESCRIPTION_UPDATE',
    'TREATMENT_VIEW', 'TREATMENT_CREATE', 'TREATMENT_UPDATE', 'TREATMENT_STATUS_UPDATE',
    'MEDICINE_VIEW')
WHERE r.name = 'DOCTOR';

-- SUBADMIN is now only for the inventory and pharmacy desks: intake and clinical permissions move to the new roles.
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN')
  AND permission_id IN (SELECT id FROM permissions WHERE name LIKE 'APPOINTMENT\_%' OR name LIKE 'CUSTOMER\_%' OR name LIKE 'PET\_%'
       OR name LIKE 'DOCTOR\_%' OR name LIKE 'INVOICE\_%' OR name LIKE 'MEDICAL\_RECORD\_%' OR name LIKE 'TREATMENT\_%'
       OR name IN ('PRESCRIPTION_CREATE', 'PRESCRIPTION_UPDATE'));

-- 3. Existing staff move to the matching role: everyone with a doctor profile is a DOCTOR, the OPERATIONAL department is the head.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'DOCTOR')
WHERE id IN (SELECT user_id FROM doctors WHERE user_id IS NOT NULL);
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'OPERATIONAL_HEAD')
WHERE role_id = (SELECT id FROM roles WHERE name = 'SUBADMIN')
  AND department_id = (SELECT id FROM departments WHERE name = 'OPERATIONAL');

-- 4. Appointments: where a request came from, who assigned the doctor and when. New requests wait as PENDING.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'STAFF';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_source_check') THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_source_check CHECK (source IN ('APP', 'WEBSITE', 'STAFF'));
    END IF;
    -- A confirmed or completed appointment always has a doctor; only requests that are still waiting (or cancelled) may not.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_doctor_when_confirmed') THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_when_confirmed
            CHECK (status NOT IN ('CONFIRMED', 'COMPLETED') OR doctor_id IS NOT NULL) NOT VALID;
    END IF;
END $$;
ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS idx_appointments_unassigned ON appointments (created_at) WHERE doctor_id IS NULL AND status = 'PENDING';
