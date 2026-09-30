-- Production hardening.
-- 1. A doctor can hold only one active (PENDING/CONFIRMED) appointment per date and slot. The application checks first,
--    but two simultaneous requests can both pass that check; this index makes the database the final judge.
--    Doorstep windows from the website ("10:00 AM to 12:00 PM") are not clock slots and are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
    ON appointments (doctor_id, appointment_date, (UPPER(TRIM(appointment_time))))
    WHERE status IN ('PENDING', 'CONFIRMED')
      AND doctor_id IS NOT NULL
      AND UPPER(TRIM(appointment_time)) ~ '^[0-9]{2}:[0-9]{2} (AM|PM)$';

-- 2. Only known statuses can be stored.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_status_check') THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
            CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'));
    END IF;
END $$;
