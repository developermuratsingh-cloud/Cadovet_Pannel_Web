-- =========================================================
-- Phase 3 Migration: Pets Table, Customer Permissions & Test Data
-- =========================================================

-- 1. Create Pets Table
CREATE TABLE IF NOT EXISTS pets (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL,   -- Dog, Cat, Bird, Rabbit, Other
    breed VARCHAR(100),
    gender VARCHAR(10),             -- MALE, FEMALE, UNKNOWN
    date_of_birth DATE,
    weight NUMERIC(5,2),
    color VARCHAR(100),
    microchip_number VARCHAR(100),
    profile_image VARCHAR(500),
    blood_group VARCHAR(20),
    is_neutered BOOLEAN DEFAULT false,
    is_vaccinated BOOLEAN DEFAULT false,
    allergies TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);

-- 2. Ensure Role Permissions for CUSTOMER role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'CUSTOMER'
  AND p.name IN ('PET_VIEW', 'PET_CREATE', 'PET_UPDATE', 'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'ORDER_VIEW', 'PRESCRIPTION_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Ensure Role Permissions for SUBADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SUBADMIN'
  AND p.name IN (
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE',
    'PET_VIEW', 'PET_CREATE', 'PET_UPDATE',
    'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE', 'APPOINTMENT_CANCEL',
    'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_STATUS_UPDATE',
    'TREATMENT_VIEW', 'TREATMENT_CREATE', 'TREATMENT_UPDATE', 'TREATMENT_STATUS_UPDATE',
    'PRESCRIPTION_VIEW', 'PRESCRIPTION_CREATE', 'PRESCRIPTION_UPDATE', 'PRESCRIPTION_PROCESS',
    'MEDICINE_VIEW', 'MEDICINE_CREATE', 'MEDICINE_UPDATE',
    'PAYMENT_VIEW', 'PAYMENT_UPDATE',
    'DOCTOR_VIEW', 'REPORT_VIEW'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Seed Test Users with Known Passwords

-- 4a. Update Super Admin password to known 'admin123'
UPDATE users 
SET password_hash = '$2b$10$4QcZGMJu7e7CbgmFldwYz.JsTfdV2Wfl6j5EQfaRHCEUutjX/Bqbe',
    mobile = COALESCE(mobile, '9876543210')
WHERE email = 'admin@cadovet.com';

-- 4b. Seed Doctor SubAdmin (doctor@cadovet.com / doctor123)
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id)
VALUES (
    'Dr. Alex Sharma',
    'doctor@cadovet.com',
    '9876543211',
    '$2b$10$Tk4TINd40YW/syCVZegtkuqMAaXrq2VxezQhoklogUxHuFEh.LJya',
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'SUBADMIN'),
    (SELECT id FROM departments WHERE name = 'DOCTOR')
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    department_id = EXCLUDED.department_id,
    role_id = EXCLUDED.role_id;

-- 4c. Seed Operations SubAdmin (ops@cadovet.com / staff123)
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id)
VALUES (
    'Priya Patel (Staff)',
    'ops@cadovet.com',
    '9876543212',
    '$2b$10$KyKAyJreYdhLFkdushu4LOQbExMOTFwRqH6RqPSCQws/Gi4epFDX2',
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'SUBADMIN'),
    (SELECT id FROM departments WHERE name = 'OPERATIONAL')
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    department_id = EXCLUDED.department_id,
    role_id = EXCLUDED.role_id;

-- 4d. Seed an additional Operations Head test account (operations.head@cadovet.com / OpsHead!2026#Cado)
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id)
VALUES (
    'Operations Head Test',
    'operations.head@cadovet.com',
    '9876543218',
    '$2b$10$sthTEAd7vVWGMUlciC4Djeuk0LmWDwCLyyBg3JDKkYD7Jcb0e3yfa',
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'SUBADMIN'),
    (SELECT id FROM departments WHERE name = 'OPERATIONAL')
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    department_id = EXCLUDED.department_id,
    role_id = EXCLUDED.role_id;

-- 4d. Seed Customer 1 (customer@cadovet.com / customer123)
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id)
VALUES (
    'Rahul Verma',
    'customer@cadovet.com',
    '9876543213',
    '$2b$10$pHlHIygAdreFYjCgIiMgl.zfsM/3s0PcxuI.q9QMIoD7VmenszwTu',
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'CUSTOMER')
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role_id = EXCLUDED.role_id;

-- Insert customer profile for Rahul
INSERT INTO customers (user_id, address, city, state, pincode, notes)
SELECT id, '42 Park Avenue, Koramangala', 'Bangalore', 'Karnataka', '560034', 'Regular pet parent, 2 pets'
FROM users WHERE email = 'customer@cadovet.com'
ON CONFLICT (user_id) DO UPDATE
SET address = EXCLUDED.address, city = EXCLUDED.city, state = EXCLUDED.state;

-- 4e. Seed Customer 2 (sarah@cadovet.com / customer123)
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id)
VALUES (
    'Sarah Jenkins',
    'sarah@cadovet.com',
    '9876543214',
    '$2b$10$pHlHIygAdreFYjCgIiMgl.zfsM/3s0PcxuI.q9QMIoD7VmenszwTu',
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'CUSTOMER')
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role_id = EXCLUDED.role_id;

-- Insert customer profile for Sarah
INSERT INTO customers (user_id, address, city, state, pincode, notes)
SELECT id, '108 Indiranagar 100ft Road', 'Bangalore', 'Karnataka', '560038', 'Prefers weekend appointments'
FROM users WHERE email = 'sarah@cadovet.com'
ON CONFLICT (user_id) DO UPDATE
SET address = EXCLUDED.address, city = EXCLUDED.city, state = EXCLUDED.state;

-- 5. Seed Sample Pets for Rahul & Sarah
DO $$
DECLARE
    rahul_cust_id INTEGER;
    sarah_cust_id INTEGER;
    admin_id INTEGER;
BEGIN
    SELECT c.id INTO rahul_cust_id FROM customers c JOIN users u ON c.user_id = u.id WHERE u.email = 'customer@cadovet.com';
    SELECT c.id INTO sarah_cust_id FROM customers c JOIN users u ON c.user_id = u.id WHERE u.email = 'sarah@cadovet.com';
    SELECT id INTO admin_id FROM users WHERE email = 'admin@cadovet.com';

    -- Check if pets already inserted
    IF NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Max' AND customer_id = rahul_cust_id) THEN
        INSERT INTO pets (customer_id, name, species, breed, gender, date_of_birth, weight, color, blood_group, is_neutered, is_vaccinated, allergies, notes, created_by)
        VALUES (
            rahul_cust_id, 'Max', 'Dog', 'Golden Retriever', 'MALE', '2023-04-12', 28.5, 'Golden Blonde', 'DEA 1.1+', true, true, 'None', 'Friendly, loves water and fetching balls.', admin_id
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Luna' AND customer_id = rahul_cust_id) THEN
        INSERT INTO pets (customer_id, name, species, breed, gender, date_of_birth, weight, color, blood_group, is_neutered, is_vaccinated, allergies, notes, created_by)
        VALUES (
            rahul_cust_id, 'Luna', 'Cat', 'Siamese', 'FEMALE', '2024-01-15', 4.2, 'Cream & Seal Point', 'Type A', true, true, 'Slight reaction to beef-based kibble', 'Calm indoor cat, vaccinated on schedule.', admin_id
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Rocky' AND customer_id = sarah_cust_id) THEN
        INSERT INTO pets (customer_id, name, species, breed, gender, date_of_birth, weight, color, blood_group, is_neutered, is_vaccinated, allergies, notes, created_by)
        VALUES (
            sarah_cust_id, 'Rocky', 'Dog', 'German Shepherd', 'MALE', '2022-09-20', 34.0, 'Black & Tan', 'DEA 1.1-', false, true, 'Dust mites', 'Active guard dog, highly responsive to agility training.', admin_id
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Bella' AND customer_id = sarah_cust_id) THEN
        INSERT INTO pets (customer_id, name, species, breed, gender, date_of_birth, weight, color, blood_group, is_neutered, is_vaccinated, allergies, notes, created_by)
        VALUES (
            sarah_cust_id, 'Bella', 'Cat', 'Persian Longhair', 'FEMALE', '2023-11-05', 3.8, 'Pure White', 'Type B', true, true, 'None', 'Fluffy indoor cat, requires regular brushing.', admin_id
        );
    END IF;
END $$;
