-- One-time passcodes for passwordless sign-in / sign-up / account deletion, keyed by mobile number (a sign-up has no user
-- row yet). Only a keyed hash of the 6-digit code is stored; codes expire and allow limited attempts.
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    purpose VARCHAR(10) NOT NULL CHECK (purpose IN ('LOGIN', 'SIGNUP', 'DELETE')),
    mobile VARCHAR(20) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_lookup ON otp_codes(mobile, purpose, created_at DESC);
