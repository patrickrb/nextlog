-- Adds the propagation feature tables that exist in drizzle/schema.ts but
-- are missing from installs that were bootstrapped before the canonical
-- baseline (or that ran the installer's "existing-install" backfill, which
-- marks 0000_baseline_canonical_schema as already-applied without verifying
-- every table exists).
--
-- Safe to run on:
--   - existing installs missing these tables (creates them)
--   - fresh installs that already got them from the baseline (no-op)
--   - re-runs (no-op)
--
-- Each statement is idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF
-- NOT EXISTS, and DO-block guards around ADD CONSTRAINT.

CREATE TABLE IF NOT EXISTS "propagation_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"alert_type" varchar(30) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "propagation_alerts_alert_type_check" CHECK ((alert_type)::text = ANY ((ARRAY['solar_storm'::character varying, 'enhanced_propagation'::character varying, 'band_opening'::character varying, 'aurora'::character varying])::text[])),
	CONSTRAINT "propagation_alerts_severity_check" CHECK ((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])),
	CONSTRAINT "valid_alert_type" CHECK ((alert_type)::text = ANY ((ARRAY['solar_storm'::character varying, 'enhanced_propagation'::character varying, 'band_opening'::character varying, 'aurora'::character varying])::text[])),
	CONSTRAINT "valid_severity" CHECK ((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "propagation_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"forecast_for" timestamp NOT NULL,
	"band_conditions" jsonb NOT NULL,
	"general_conditions" varchar(20) NOT NULL,
	"notes" text,
	"source" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "propagation_forecasts_general_conditions_check" CHECK ((general_conditions)::text = ANY ((ARRAY['poor'::character varying, 'fair'::character varying, 'good'::character varying, 'excellent'::character varying])::text[])),
	CONSTRAINT "valid_general_conditions" CHECK ((general_conditions)::text = ANY ((ARRAY['poor'::character varying, 'fair'::character varying, 'good'::character varying, 'excellent'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "solar_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"solar_flux_index" numeric(6, 2) NOT NULL,
	"a_index" numeric(5, 2) NOT NULL,
	"k_index" numeric(3, 1) NOT NULL,
	"solar_wind_speed" numeric(7, 2),
	"solar_wind_density" numeric(6, 3),
	"xray_class" varchar(5),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "solar_activity_timestamp_key" UNIQUE("timestamp")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_propagation_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"home_grid_locator" varchar(10),
	"preferred_bands" text[],
	"alert_solar_storms" boolean DEFAULT true,
	"alert_enhanced_propagation" boolean DEFAULT true,
	"alert_band_openings" boolean DEFAULT false,
	"alert_aurora" boolean DEFAULT false,
	"update_interval_minutes" integer DEFAULT 60,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "user_propagation_preferences_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "user_propagation_preferences_update_interval_minutes_check" CHECK (update_interval_minutes >= 15)
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'propagation_alerts_user_id_fkey') THEN
		ALTER TABLE "propagation_alerts" ADD CONSTRAINT "propagation_alerts_user_id_fkey"
			FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_propagation_preferences_user_id_fkey') THEN
		ALTER TABLE "user_propagation_preferences" ADD CONSTRAINT "user_propagation_preferences_user_id_fkey"
			FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propagation_alerts_active" ON "propagation_alerts" USING btree ("is_active" bool_ops) WHERE (is_active = true);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propagation_alerts_expires" ON "propagation_alerts" USING btree ("expires_at" timestamp_ops) WHERE (expires_at IS NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propagation_alerts_user_id" ON "propagation_alerts" USING btree ("user_id" int4_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propagation_forecasts_forecast_for" ON "propagation_forecasts" USING btree ("forecast_for" timestamp_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propagation_forecasts_timestamp" ON "propagation_forecasts" USING btree ("timestamp" timestamp_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_solar_activity_timestamp" ON "solar_activity" USING btree ("timestamp" timestamp_ops);
