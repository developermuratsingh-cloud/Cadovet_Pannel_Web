-- Emergency hours: a visit whose start time falls from 9:00 PM up to (not including) 9:00 AM is an emergency booking.
--
--   * services.emergency_price  - what the service costs in emergency hours, set per service by an administrator.
--                                  NULL means "no emergency price set yet": the normal price applies (the visit is
--                                  still flagged and prioritised).
--   * appointments.is_emergency - stored, not derived on read, so staff lists can sort and filter on it. The server
--                                  sets it from appointment_time every time an appointment is created or its time
--                                  changes; clients never send it.
--
-- Safe to run more than once.

ALTER TABLE services ADD COLUMN IF NOT EXISTS emergency_price NUMERIC(10,2)
    CHECK (emergency_price IS NULL OR emergency_price >= 0);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT FALSE;

-- Flag the visits that are still ahead of us. Past and finished visits keep FALSE: they were priced and handled as
-- ordinary bookings, and a badge on them now would be misleading.
UPDATE appointments
SET is_emergency = TRUE
WHERE status IN ('PENDING', 'CONFIRMED')
  AND appointment_date >= CURRENT_DATE
  AND appointment_time ~* '^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$'
  AND (to_timestamp(upper(trim(appointment_time)), 'HH12:MI AM')::time >= TIME '21:00'
       OR to_timestamp(upper(trim(appointment_time)), 'HH12:MI AM')::time < TIME '09:00');

CREATE INDEX IF NOT EXISTS idx_appointments_emergency_active
    ON appointments (appointment_date) WHERE is_emergency AND status IN ('PENDING', 'CONFIRMED');
