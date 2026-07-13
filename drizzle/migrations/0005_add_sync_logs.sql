CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"station_id" integer,
	"service" varchar(10) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"trigger" varchar(10) NOT NULL,
	"status" varchar(12) NOT NULL,
	"started_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp,
	"qso_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"matched_count" integer DEFAULT 0,
	"error_message" text,
	"details" jsonb,
	CONSTRAINT "sync_logs_service_check" CHECK ((service)::text = ANY ((ARRAY['qrz'::character varying, 'lotw'::character varying, 'eqsl'::character varying])::text[])),
	CONSTRAINT "sync_logs_direction_check" CHECK ((direction)::text = ANY ((ARRAY['upload'::character varying, 'download'::character varying])::text[])),
	CONSTRAINT "sync_logs_trigger_check" CHECK ((trigger)::text = ANY ((ARRAY['manual'::character varying, 'auto'::character varying, 'cron'::character varying])::text[])),
	CONSTRAINT "sync_logs_status_check" CHECK ((status)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying])::text[]))
);
--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sync_logs_user_started" ON "sync_logs" USING btree ("user_id" int4_ops,"started_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_sync_logs_station_id" ON "sync_logs" USING btree ("station_id" int4_ops);