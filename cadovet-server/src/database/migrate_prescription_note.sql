-- A "note-only" medical record (no diagnosis visit, just a quick prescription note) is flagged so it can be told apart
-- from a full visit record in the Prescriptions view.
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS is_prescription_note BOOLEAN NOT NULL DEFAULT FALSE;
