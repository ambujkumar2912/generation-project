-- Additive Phase 2 identity fields; legacy accounts remain intact.
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_status TEXT NOT NULL DEFAULT 'not_verified';
ALTER TABLE users ADD CONSTRAINT users_phone_verification_status_check CHECK (phone_verification_status IN ('not_verified', 'verified'));
CREATE OR REPLACE FUNCTION prevent_date_of_birth_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.date_of_birth IS NOT NULL AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    RAISE EXCEPTION 'date_of_birth cannot be changed after account creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_users_date_of_birth_immutable BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION prevent_date_of_birth_change();
