-- Insert Departments
INSERT INTO departments (name, description) VALUES
('DOCTOR', 'Doctor SubAdmin Department'),
('OPERATIONAL', 'Operational SubAdmin Department'),
('INVENTORY', 'Inventory SubAdmin Department'),
('MEDICINE', 'Medicine SubAdmin Department');

-- Insert Roles
INSERT INTO roles (name, description) VALUES
('ADMIN', 'Full system access'),
('SUBADMIN', 'Department specific access'),
('CUSTOMER', 'Customer portal access');

-- Insert Permissions
INSERT INTO permissions (name, description) VALUES
('CUSTOMER_VIEW', 'Can view customers'),
('CUSTOMER_CREATE', 'Can create customers'),
('CUSTOMER_UPDATE', 'Can update customers'),
('CUSTOMER_DELETE', 'Can delete customers'),
('PET_VIEW', 'Can view pets'),
('PET_CREATE', 'Can create pets'),
('PET_UPDATE', 'Can update pets'),
('APPOINTMENT_VIEW', 'Can view appointments'),
('APPOINTMENT_CREATE', 'Can create appointments'),
('APPOINTMENT_UPDATE', 'Can update appointments'),
('APPOINTMENT_CANCEL', 'Can cancel appointments'),
('ORDER_VIEW', 'Can view orders'),
('ORDER_CREATE', 'Can create orders'),
('ORDER_UPDATE', 'Can update orders'),
('ORDER_STATUS_UPDATE', 'Can update order status'),
('TREATMENT_VIEW', 'Can view treatments'),
('TREATMENT_CREATE', 'Can create treatments'),
('TREATMENT_UPDATE', 'Can update treatments'),
('TREATMENT_STATUS_UPDATE', 'Can update treatment status'),
('PRESCRIPTION_VIEW', 'Can view prescriptions'),
('PRESCRIPTION_CREATE', 'Can create prescriptions'),
('PRESCRIPTION_UPDATE', 'Can update prescriptions'),
('PRESCRIPTION_PROCESS', 'Can process prescriptions'),
('MEDICINE_VIEW', 'Can view medicines'),
('MEDICINE_CREATE', 'Can create medicines'),
('MEDICINE_UPDATE', 'Can update medicines'),
('INVENTORY_VIEW', 'Can view inventory'),
('INVENTORY_CREATE', 'Can create inventory'),
('INVENTORY_UPDATE', 'Can update inventory'),
('INVENTORY_STOCK_UPDATE', 'Can update inventory stock'),
('PAYMENT_VIEW', 'Can view payments'),
('PAYMENT_UPDATE', 'Can update payments'),
('DOCTOR_VIEW', 'Can view doctors'),
('DOCTOR_CREATE', 'Can create doctors'),
('DOCTOR_UPDATE', 'Can update doctors'),
('DOCTOR_IMAGE_UPLOAD', 'Can upload doctor image'),
('REPORT_VIEW', 'Can view reports'),
('USER_CREATE', 'Can create users'),
('USER_UPDATE', 'Can update users'),
('ROLE_MANAGE', 'Can manage roles'),
('PERMISSION_MANAGE', 'Can manage permissions');

-- Admin Role gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'ADMIN'), id FROM permissions;

-- SubAdmin (Operational) gets some permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'SUBADMIN'), id FROM permissions
WHERE name IN ('CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'PET_VIEW', 'PET_CREATE', 'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_STATUS_UPDATE', 'TREATMENT_VIEW', 'TREATMENT_STATUS_UPDATE', 'PAYMENT_VIEW', 'PAYMENT_UPDATE');

-- Create a development Admin user (password: Admin@123 -> $2a$10$QO0R5x5mX2YtD9k.3f3J.O.7o.N/Z.3b8.K/2rK4b5v6J7G8E9F0G -> Wait, I need a hashed password, I'll generate one in node)
-- For now I'll just use a pre-hashed password for 'admin123'
-- Hash for 'admin123' using bcrypt with 10 rounds: $2a$10$wN2a.3vNl8.8iF/z.aQ8UOfQcO7JqB3b0jR3/s0p7Bq/5F1B9qR4C
INSERT INTO users (name, email, password_hash, identifier_type, role_id) VALUES
('Super Admin', 'admin@cadovet.com', '$2b$10$D8EPqe3tpuHA2XfruaepS.bDs8VfvJtsDVcLkRIuBevmNg6WAoidu', 'EMAIL', (SELECT id FROM roles WHERE name = 'ADMIN'));
