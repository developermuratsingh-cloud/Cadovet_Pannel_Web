-- The doctor panel drops the staff/doctor directory and the customer directory entirely: a doctor works only from their
-- own assigned appointments, which already carry the patient's and owner's details.
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'DOCTOR')
  AND permission_id IN (SELECT id FROM permissions WHERE name IN ('DOCTOR_VIEW', 'CUSTOMER_VIEW'));
