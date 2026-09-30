-- Pharmacy/Inventory dispense log: every hand-off of stock to a doctor, and every use of that stock on a
-- patient, plus a doctor's "this doesn't look right" reports against a dispense entry.
--
-- This table existed in the live database (built up interactively across earlier sessions) but was never
-- captured in a migration file, so a fresh install from this repo's own documented setup steps was missing
-- the entire pharmacy dispense/dispute feature. Recovered here from the live schema so `npm test`'s
-- from-scratch database bootstrap, and any new environment, actually gets the tables this feature needs.
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DISPENSE_TO_DOCTOR', 'USED_ON_PATIENT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    department_id INTEGER REFERENCES departments(id),
    doctor_id INTEGER REFERENCES doctors(id),
    pet_id INTEGER REFERENCES pets(id),
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    performed_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inv_txn_doctor ON inventory_transactions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_inventory ON inventory_transactions(inventory_id);

CREATE TABLE IF NOT EXISTS inventory_disputes (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES inventory_transactions(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id),
    department_id INTEGER REFERENCES departments(id),
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'FORWARDED', 'RESOLVED')),
    ops_reviewed_by INTEGER REFERENCES users(id),
    ops_reviewed_at TIMESTAMP,
    ops_note TEXT,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inv_dispute_doctor ON inventory_disputes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_inv_dispute_status ON inventory_disputes(status);
CREATE INDEX IF NOT EXISTS idx_inv_dispute_txn ON inventory_disputes(transaction_id);
