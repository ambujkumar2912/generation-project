-- Public username identity. Legacy accounts remain nullable until transitioned.
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN username_initialized_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN last_username_change_at TIMESTAMPTZ;
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_]{6,20}$');
ALTER TABLE users ADD CONSTRAINT users_username_normalized CHECK (username IS NULL OR username = lower(username));
CREATE UNIQUE INDEX idx_users_username_unique ON users (username) WHERE username IS NOT NULL;
