-- =========================================================
-- Phase 4 Migration: Services, Doctors, and Appointments
-- =========================================================

-- 1. Services Table
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

-- 2. Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialization VARCHAR(150) NOT NULL,
    qualification VARCHAR(100),
    experience_years INTEGER DEFAULT 0,
    consultation_fee NUMERIC(10,2) DEFAULT 500.00,
    available_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
    available_from TIME DEFAULT '09:00:00',
    available_to TIME DEFAULT '18:00:00',
    bio TEXT,
    rating NUMERIC(3,2) DEFAULT 4.9,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(status);

-- 3. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(20) NOT NULL,
    reason TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'CONFIRMED', -- PENDING, CONFIRMED, COMPLETED, CANCELLED
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 4. New Permissions for Services
INSERT INTO permissions (name, description) VALUES
('SERVICE_VIEW', 'Can view hospital services'),
('SERVICE_MANAGE', 'Can create and update services')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'ADMIN'), id FROM permissions
WHERE name IN ('SERVICE_VIEW', 'SERVICE_MANAGE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant permissions to SUBADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'SUBADMIN'), id FROM permissions
WHERE name IN ('SERVICE_VIEW', 'SERVICE_MANAGE', 'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE', 'APPOINTMENT_CANCEL', 'DOCTOR_VIEW', 'DOCTOR_CREATE', 'DOCTOR_UPDATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant permissions to CUSTOMER
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'CUSTOMER'), id FROM permissions
WHERE name IN ('SERVICE_VIEW', 'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_CANCEL', 'DOCTOR_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Seed Services
INSERT INTO services (name, category, description, price, duration_minutes) VALUES
('General Checkup & Consultation', 'Consultation', 'Comprehensive physical examination, vitals check, nutrition and wellness review.', 500.00, 30),
('Puppy & Kitten Core Vaccination', 'Preventive Care', 'DHLPP/FVRCP core immunization shots with digital certificate.', 850.00, 20),
('Rabies Vaccination & Tag', 'Preventive Care', 'Annual anti-rabies vaccine with official clinic immunization card.', 450.00, 15),
('Ultrasonic Dental Scaling & Polishing', 'Dental', 'Full mouth ultrasonic tartar removal, plaque cleaning and antiseptic rinse under mild sedation.', 2500.00, 60),
('Spay & Neuter Surgery', 'Surgery', 'Safe laparoscopic sterilization procedure with dedicated post-op monitoring and recovery suite.', 4800.00, 90),
('Complete Pet Grooming & Spa', 'Grooming', 'Medicated bath, blow dry, de-shedding, nail clipping, ear cleaning, and styling.', 1500.00, 60),
('Abdominal Ultrasound & Diagnostics', 'Diagnostics', 'High-definition digital sonography with instant radiologist reporting.', 2200.00, 45)
ON CONFLICT DO NOTHING;

-- 6. Seed Additional Doctor Account: Dr. Meera Reddy
INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id)
VALUES (
    'Dr. Meera Reddy',
    'meera@cadovet.com',
    '9876543215',
    '$2b$10$Tk4TINd40YW/syCVZegtkuqMAaXrq2VxezQhoklogUxHuFEh.LJya', -- doctor123
    'EMAIL',
    (SELECT id FROM roles WHERE name = 'SUBADMIN'),
    (SELECT id FROM departments WHERE name = 'DOCTOR')
)
ON CONFLICT (email) DO NOTHING;

-- 7. Link Doctors into `doctors` table
DO $$
DECLARE
    alex_user_id INTEGER;
    meera_user_id INTEGER;
BEGIN
    SELECT id INTO alex_user_id FROM users WHERE email = 'doctor@cadovet.com';
    SELECT id INTO meera_user_id FROM users WHERE email = 'meera@cadovet.com';

    IF alex_user_id IS NOT NULL THEN
        INSERT INTO doctors (user_id, specialization, qualification, experience_years, consultation_fee, available_days, available_from, available_to, bio, rating)
        VALUES (
            alex_user_id,
            'Senior Veterinary Surgeon & Canine Specialist',
            'BVSc & AH, MVSc (Surgery)',
            12,
            600.00,
            'Mon,Tue,Wed,Thu,Fri,Sat',
            '09:00:00',
            '18:00:00',
            'Expert in soft-tissue surgery, orthopedic procedures, and emergency trauma care with over 12 years clinical practice.',
            4.95
        )
        ON CONFLICT (user_id) DO UPDATE
        SET specialization = EXCLUDED.specialization, consultation_fee = EXCLUDED.consultation_fee;
    END IF;

    IF meera_user_id IS NOT NULL THEN
        INSERT INTO doctors (user_id, specialization, qualification, experience_years, consultation_fee, available_days, available_from, available_to, bio, rating)
        VALUES (
            meera_user_id,
            'Feline Medicine & Dermatology Specialist',
            'BVSc & AH, MVSc (Medicine)',
            8,
            550.00,
            'Mon,Tue,Wed,Thu,Fri',
            '10:00:00',
            '19:00:00',
            'Specialized in feline behavior, chronic renal management, dermatology allergies, and preventative wellness.',
            4.90
        )
        ON CONFLICT (user_id) DO UPDATE
        SET specialization = EXCLUDED.specialization, consultation_fee = EXCLUDED.consultation_fee;
    END IF;
END $$;

-- 8. Seed Sample Appointments
DO $$
DECLARE
    rahul_cust_id INTEGER;
    sarah_cust_id INTEGER;
    max_pet_id INTEGER;
    luna_pet_id INTEGER;
    rocky_pet_id INTEGER;
    doc_alex_id INTEGER;
    doc_meera_id INTEGER;
    srv_checkup_id INTEGER;
    srv_vax_id INTEGER;
    srv_dental_id INTEGER;
BEGIN
    SELECT c.id INTO rahul_cust_id FROM customers c JOIN users u ON c.user_id = u.id WHERE u.email = 'customer@cadovet.com';
    SELECT c.id INTO sarah_cust_id FROM customers c JOIN users u ON c.user_id = u.id WHERE u.email = 'sarah@cadovet.com';

    SELECT id INTO max_pet_id FROM pets WHERE name = 'Max' AND customer_id = rahul_cust_id LIMIT 1;
    SELECT id INTO luna_pet_id FROM pets WHERE name = 'Luna' AND customer_id = rahul_cust_id LIMIT 1;
    SELECT id INTO rocky_pet_id FROM pets WHERE name = 'Rocky' AND customer_id = sarah_cust_id LIMIT 1;

    SELECT d.id INTO doc_alex_id FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.email = 'doctor@cadovet.com';
    SELECT d.id INTO doc_meera_id FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.email = 'meera@cadovet.com';

    SELECT id INTO srv_checkup_id FROM services WHERE name LIKE 'General Checkup%' LIMIT 1;
    SELECT id INTO srv_vax_id FROM services WHERE name LIKE '%Vaccination%' LIMIT 1;
    SELECT id INTO srv_dental_id FROM services WHERE name LIKE '%Dental%' LIMIT 1;

    -- Appointment 1: Max with Dr. Alex
    IF max_pet_id IS NOT NULL AND doc_alex_id IS NOT NULL THEN
        INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status)
        VALUES (
            rahul_cust_id, max_pet_id, doc_alex_id, srv_checkup_id,
            CURRENT_DATE + INTERVAL '1 day', '10:30 AM',
            'Annual wellness checkup and mobility review',
            'Client noted slight stiffness in hind legs after morning walks.',
            'CONFIRMED'
        );
    END IF;

    -- Appointment 2: Luna with Dr. Meera
    IF luna_pet_id IS NOT NULL AND doc_meera_id IS NOT NULL THEN
        INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status)
        VALUES (
            rahul_cust_id, luna_pet_id, doc_meera_id, srv_vax_id,
            CURRENT_DATE + INTERVAL '3 days', '02:00 PM',
            'Booster vaccine & dietary checkup',
            'Check weight progression and prescribe sensitive stomach formula.',
            'CONFIRMED'
        );
    END IF;

    -- Appointment 3: Rocky with Dr. Alex
    IF rocky_pet_id IS NOT NULL AND doc_alex_id IS NOT NULL THEN
        INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status)
        VALUES (
            sarah_cust_id, rocky_pet_id, doc_alex_id, srv_dental_id,
            CURRENT_DATE, '04:30 PM',
            'Routine dental scaling and tartar assessment',
            'Mild plaque on molars, pre-dental exam scheduled.',
            'CONFIRMED'
        );
    END IF;
END $$;
