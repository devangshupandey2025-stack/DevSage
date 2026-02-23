-- Add password_must_change flag for judge accounts created with temp credentials
ALTER TABLE users ADD COLUMN password_must_change INTEGER NOT NULL DEFAULT 0;
