-- Staff (admin, operational head, doctors, desk staff) sign in with email + password; customers sign in with mobile + OTP.
-- must_change_password: an administrator-set (temporary) password has to be replaced at first sign-in.
-- token_version: stamped into every access token and bumped on each password change/reset, so the change signs the account
-- out everywhere at once (a stolen token dies with the old password). password_changed_at is kept for the record.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
