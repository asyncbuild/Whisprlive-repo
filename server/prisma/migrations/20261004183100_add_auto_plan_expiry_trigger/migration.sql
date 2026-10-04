-- Create or replace trigger function to auto-assign 1-month plan expiry on direct DB inserts/updates
CREATE OR REPLACE FUNCTION auto_set_plan_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- If plan is updated/inserted as HOST or STUDIO
  IF (NEW.plan IN ('HOST', 'STUDIO')) THEN
    -- If it's a new row, or plan changed, or planExpiresAt was not explicitly provided
    IF (TG_OP = 'INSERT' OR OLD.plan IS DISTINCT FROM NEW.plan OR NEW."planExpiresAt" IS NULL) THEN
      NEW."planExpiresAt" := NOW() + INTERVAL '1 month';
    END IF;
  ELSIF (NEW.plan = 'SOLO') THEN
    NEW."planExpiresAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to User table
DROP TRIGGER IF EXISTS trg_auto_plan_expiry ON "User";
CREATE TRIGGER trg_auto_plan_expiry
BEFORE INSERT OR UPDATE OF plan, "planExpiresAt"
ON "User"
FOR EACH ROW
EXECUTE FUNCTION auto_set_plan_expiry();
