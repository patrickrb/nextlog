-- Adds the lotw_credentials.name column that exists in drizzle/schema.ts
-- (declared NOT NULL) but is missing from installs that were bootstrapped
-- before the canonical baseline. Same root cause as 0002: the install-flow
-- backfill marked 0000_baseline_canonical_schema as already-applied without
-- verifying every column existed.
--
-- Symptom: POST /api/lotw/certificate returns 500 because the INSERT names
-- a `name` column that doesn't exist.
--
-- Strategy: add the column as nullable, backfill any existing rows from
-- callsign, then SET NOT NULL. Idempotent — re-running is a no-op.

ALTER TABLE "lotw_credentials" ADD COLUMN IF NOT EXISTS "name" varchar(255);
--> statement-breakpoint
UPDATE "lotw_credentials"
SET "name" = CONCAT(callsign, ' - LoTW Certificate')
WHERE "name" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND table_name = 'lotw_credentials'
		  AND column_name = 'name'
		  AND is_nullable = 'YES'
	) THEN
		ALTER TABLE "lotw_credentials" ALTER COLUMN "name" SET NOT NULL;
	END IF;
END $$;
