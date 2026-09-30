-- =========================================================
-- Phase 5 & 6 Migration: Clinical Records, Rx, Invoices & Pharmacy Inventory
-- =========================================================

-- 1. Medical Records & Clinical Consultations
CREATE TABLE IF NOT EXISTS medical_records (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    visit_date DATE DEFAULT CURRENT_DATE,
    symptoms TEXT,
    diagnosis TEXT NOT NULL,
    temperature_f NUMERIC(4,1),
    weight_kg NUMERIC(5,2),
    treatment_notes TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_id ON medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_visit_date ON medical_records(visit_date);

-- 2. Digital Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    medical_record_id INTEGER NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    medicine_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration_days INTEGER DEFAULT 5,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_record_id ON prescriptions(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pet_id ON prescriptions(pet_id);

-- 3. Invoices & Billing
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10,2) DEFAULT 0.00,
    discount NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'PAID', -- PAID, PENDING, CANCELLED
    payment_method VARCHAR(30) DEFAULT 'CARD', -- CASH, CARD, UPI, ONLINE
    invoice_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- 4. Pharmacy & Medical Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- MEDICINE, VACCINE, SURGICAL, SUPPLEMENT, CONSUMABLE
    sku VARCHAR(50) UNIQUE NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_alert_quantity INTEGER DEFAULT 10,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    expiry_date DATE,
    supplier VARCHAR(100),
    status VARCHAR(20) DEFAULT 'IN_STOCK', -- IN_STOCK, LOW_STOCK, OUT_OF_STOCK
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- 5. Add New Permissions
INSERT INTO permissions (name, description) VALUES
('MEDICAL_RECORD_VIEW', 'Can view pet clinical & medical records'),
('MEDICAL_RECORD_MANAGE', 'Can create and update clinical consultations'),
('INVOICE_VIEW', 'Can view hospital billing invoices'),
('INVOICE_MANAGE', 'Can generate and update hospital invoices'),
('INVENTORY_VIEW', 'Can view pharmacy inventory & stock levels'),
('INVENTORY_MANAGE', 'Can adjust inventory and add pharmaceutical supplies')
ON CONFLICT (name) DO NOTHING;

-- Grant to ADMIN (All)
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'ADMIN'), id FROM permissions
WHERE name IN (
    'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_MANAGE',
    'INVOICE_VIEW', 'INVOICE_MANAGE',
    'INVENTORY_VIEW', 'INVENTORY_MANAGE'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant to SUBADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'SUBADMIN'), id FROM permissions
WHERE name IN (
    'MEDICAL_RECORD_VIEW', 'MEDICAL_RECORD_MANAGE',
    'INVOICE_VIEW', 'INVOICE_MANAGE',
    'INVENTORY_VIEW', 'INVENTORY_MANAGE'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant to CUSTOMER (Can view their pets medical records & invoices)
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'CUSTOMER'), id FROM permissions
WHERE name IN ('MEDICAL_RECORD_VIEW', 'INVOICE_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 6. Seed Test Accounts for INVENTORY and MEDICINE SubAdmins
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id)
VALUES 
(
    'David Miller',
    'inventory@cadovet.com',
    '9876543216',
    '$2b$10$V1Pzc7Jaw/Ex9pVsqFBkfeagQgCpqjM8.F01FUBx8ymdT9aZxoRbq', -- admin123
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'SUBADMIN'),
    (SELECT id FROM departments WHERE name = 'INVENTORY')
),
(
    'Pharm. Priya Sen',
    'pharmacy@cadovet.com',
    '9876543217',
    '$2b$10$V1Pzc7Jaw/Ex9pVsqFBkfeagQgCpqjM8.F01FUBx8ymdT9aZxoRbq', -- admin123
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'SUBADMIN'),
    (SELECT id FROM departments WHERE name = 'MEDICINE')
)
ON CONFLICT (email) DO NOTHING;

-- 7. Seed Sample Inventory Items
INSERT INTO inventory (name, category, sku, stock_quantity, min_alert_quantity, unit_price, expiry_date, supplier, status) VALUES
('Amoxicillin & Clavulanate 250mg Tablets', 'MEDICINE', 'MED-AMO-250', 85, 20, 14.50, '2027-05-30', 'VetPharma Labs', 'IN_STOCK'),
('Meloxicam 1.5mg/ml Oral Suspension', 'MEDICINE', 'MED-MEL-15', 38, 15, 22.00, '2026-11-15', 'Zoetis Health', 'IN_STOCK'),
('Nobivac Rabies 10-Dose Vial', 'VACCINE', 'VAC-NOB-RAB', 12, 15, 180.00, '2027-01-20', 'MSD Animal Health', 'LOW_STOCK'),
('Canine Distemper Core DHPPI Vaccine', 'VACCINE', 'VAC-CAN-DHP', 45, 10, 240.00, '2027-04-10', 'MSD Animal Health', 'IN_STOCK'),
('Suture Polyglactin 910 Size 3-0 Box', 'SURGICAL', 'SUR-SUT-30', 25, 10, 45.00, '2028-08-01', 'Ethicon Vet', 'IN_STOCK'),
('Sterile Gauze Sponges 4x4 Pack', 'CONSUMABLE', 'CON-GAU-44', 150, 30, 8.00, '2029-01-01', 'MedVet Supplies', 'IN_STOCK'),
('Omega-3 Salmon Oil Coat Supplement 500ml', 'SUPPLEMENT', 'SUP-OME-500', 6, 12, 35.00, '2026-12-31', 'Nordic Naturals Pet', 'LOW_STOCK'),
('Cefalexin 300mg Flavored Chewables', 'MEDICINE', 'MED-CEF-300', 0, 15, 28.00, '2026-10-15', 'VetPharma Labs', 'OUT_OF_STOCK')
ON CONFLICT (sku) DO UPDATE
SET stock_quantity = EXCLUDED.stock_quantity, status = EXCLUDED.status;

-- 8. Seed Sample Clinical Consultations & Prescriptions
DO $$
DECLARE
    max_pet_id INTEGER;
    luna_pet_id INTEGER;
    doc_alex_id INTEGER;
    doc_meera_id INTEGER;
    rec1_id INTEGER;
    rec2_id INTEGER;
BEGIN
    SELECT id INTO max_pet_id FROM pets WHERE name = 'Max' LIMIT 1;
    SELECT id INTO luna_pet_id FROM pets WHERE name = 'Luna' LIMIT 1;
    SELECT id INTO doc_alex_id FROM doctors LIMIT 1;
    SELECT id INTO doc_meera_id FROM doctors OFFSET 1 LIMIT 1;

    -- Record 1 for Max
    IF max_pet_id IS NOT NULL AND doc_alex_id IS NOT NULL THEN
        INSERT INTO medical_records (pet_id, doctor_id, visit_date, symptoms, diagnosis, temperature_f, weight_kg, treatment_notes, follow_up_date)
        VALUES (
            max_pet_id, doc_alex_id, CURRENT_DATE - INTERVAL '14 days',
            'Slight limp in right hind limb after running, reluctance to climb stairs.',
            'Mild Canine Hip Dysplasia & Early Osteoarthritis Flare-up',
            101.5, 32.40,
            'Advised short leash walks. Started anti-inflammatory therapy and joint lubrication supplements.',
            CURRENT_DATE + INTERVAL '16 days'
        ) RETURNING id INTO rec1_id;

        IF rec1_id IS NOT NULL THEN
            INSERT INTO prescriptions (medical_record_id, pet_id, medicine_name, dosage, frequency, duration_days, instructions)
            VALUES 
            (rec1_id, max_pet_id, 'Meloxicam 1.5mg/ml', '3.2 ml', 'Once daily with meal', 7, 'Shake bottle well. Administer orally mixed in food.'),
            (rec1_id, max_pet_id, 'Glucosamine & Chondroitin Chewables', '1 tablet', 'Twice daily', 30, 'Give morning and evening as a treat.');
        END IF;
    END IF;

    -- Record 2 for Luna
    IF luna_pet_id IS NOT NULL THEN
        INSERT INTO medical_records (pet_id, doctor_id, visit_date, symptoms, diagnosis, temperature_f, weight_kg, treatment_notes, follow_up_date)
        VALUES (
            luna_pet_id, COALESCE(doc_meera_id, doc_alex_id), CURRENT_DATE - INTERVAL '5 days',
            'Frequent hairball vomiting, mild dull coat.',
            'Dietary Sensitivity & Hairball Impaction (Early Stage)',
            100.8, 4.20,
            'Hydration is adequate. Recommended high-fiber hairball control formula and probiotic paste.',
            CURRENT_DATE + INTERVAL '25 days'
        ) RETURNING id INTO rec2_id;

        IF rec2_id IS NOT NULL THEN
            INSERT INTO prescriptions (medical_record_id, pet_id, medicine_name, dosage, frequency, duration_days, instructions)
            VALUES 
            (rec2_id, luna_pet_id, 'Malt-Soft Hairball Remedy Paste', '2 cm strip', 'Once daily', 14, 'Offer directly from tube or mix with wet food.');
        END IF;
    END IF;
END $$;

-- 9. Seed Sample Invoices
DO $$
DECLARE
    rahul_cust_id INTEGER;
    sarah_cust_id INTEGER;
    max_pet_id INTEGER;
    rocky_pet_id INTEGER;
BEGIN
    SELECT c.id INTO rahul_cust_id FROM customers c JOIN users u ON c.user_id = u.id WHERE u.email = 'customer@cadovet.com';
    SELECT c.id INTO sarah_cust_id FROM customers c JOIN users u ON c.user_id = u.id WHERE u.email = 'sarah@cadovet.com';
    SELECT id INTO max_pet_id FROM pets WHERE name = 'Max' LIMIT 1;
    SELECT id INTO rocky_pet_id FROM pets WHERE name = 'Rocky' LIMIT 1;

    IF rahul_cust_id IS NOT NULL THEN
        INSERT INTO invoices (invoice_number, customer_id, pet_id, subtotal, tax, discount, total_amount, payment_status, payment_method, invoice_date, notes)
        VALUES (
            'INV-2026-001', rahul_cust_id, max_pet_id,
            1200.00, 60.00, 50.00, 1210.00,
            'PAID', 'UPI', CURRENT_DATE - INTERVAL '14 days',
            'Consultation fee + Joint supplements medication bill'
        ) ON CONFLICT (invoice_number) DO NOTHING;
    END IF;

    IF sarah_cust_id IS NOT NULL THEN
        INSERT INTO invoices (invoice_number, customer_id, pet_id, subtotal, tax, discount, total_amount, payment_status, payment_method, invoice_date, notes)
        VALUES (
            'INV-2026-002', sarah_cust_id, rocky_pet_id,
            2500.00, 125.00, 0.00, 2625.00,
            'PENDING', 'CARD', CURRENT_DATE,
            'Ultrasonic Dental Cleaning procedure invoice'
        ) ON CONFLICT (invoice_number) DO NOTHING;
    END IF;
END $$;
