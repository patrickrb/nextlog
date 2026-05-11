-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "api_key_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" integer NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"status_code" integer NOT NULL,
	"response_time_ms" integer,
	"bytes_sent" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"station_id" integer,
	"key_name" varchar(255) NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"api_secret" varchar(255) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"read_only" boolean DEFAULT false NOT NULL,
	"allowed_endpoints" text[],
	"rate_limit_per_hour" integer DEFAULT 1000,
	"last_used_at" timestamp,
	"total_requests" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"expires_at" timestamp,
	CONSTRAINT "unique_user_key_name" UNIQUE("user_id","key_name"),
	CONSTRAINT "api_keys_api_key_key" UNIQUE("api_key"),
	CONSTRAINT "check_api_key_format" CHECK (CHECK (is_valid_api_key_format((api_key)::text)
);
--> statement-breakpoint
CREATE TABLE "lotw_upload_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"qso_count" integer DEFAULT 0 NOT NULL,
	"date_from" date,
	"date_to" date,
	"file_hash" varchar(64),
	"file_size_bytes" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"completed_at" timestamp,
	"success_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"error_message" text,
	"lotw_response" text,
	"upload_method" varchar(20) DEFAULT 'manual',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "lotw_upload_logs_status_check" CHECK ((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])),
	CONSTRAINT "lotw_upload_logs_upload_method_check" CHECK ((upload_method)::text = ANY ((ARRAY['manual'::character varying, 'automatic'::character varying, 'scheduled'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "lotw_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"callsign" varchar(50) NOT NULL,
	"p12_cert" "bytea" NOT NULL,
	"cert_created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"cert_expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"p12_password" text,
	"cert_serial" text,
	"crl_status" varchar(16),
	"crl_checked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lotw_download_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date_from" date,
	"date_to" date,
	"qso_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"completed_at" timestamp,
	"confirmations_found" integer DEFAULT 0,
	"confirmations_matched" integer DEFAULT 0,
	"confirmations_unmatched" integer DEFAULT 0,
	"error_message" text,
	"download_method" varchar(20) DEFAULT 'manual',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "lotw_download_logs_status_check" CHECK ((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])),
	CONSTRAINT "lotw_download_logs_download_method_check" CHECK ((download_method)::text = ANY ((ARRAY['manual'::character varying, 'automatic'::character varying, 'scheduled'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "lotw_job_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" varchar(20) NOT NULL,
	"station_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"job_params" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"is_running" boolean DEFAULT false,
	"scheduled_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"started_at" timestamp,
	"completed_at" timestamp,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"error_message" text,
	"result" jsonb,
	"priority" integer DEFAULT 5,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "lotw_job_queue_job_type_check" CHECK ((job_type)::text = ANY ((ARRAY['upload'::character varying, 'download'::character varying])::text[])),
	CONSTRAINT "lotw_job_queue_status_check" CHECK ((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"callsign" varchar(50),
	"grid_locator" varchar(10),
	"qrz_username" varchar(255),
	"qrz_password" varchar(255),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"third_party_services" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"callsign" varchar(50) NOT NULL,
	"station_name" varchar(255) NOT NULL,
	"operator_name" varchar(255),
	"qth_name" varchar(255),
	"street_address" varchar(255),
	"city" varchar(100),
	"county" varchar(100),
	"state_province" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100),
	"dxcc_entity_code" integer,
	"grid_locator" varchar(10),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"itu_zone" integer,
	"cq_zone" integer,
	"power_watts" integer,
	"rig_info" text,
	"antenna_info" text,
	"station_equipment" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"qrz_username" varchar(255),
	"qrz_password" varchar(255),
	"lotw_username" varchar(255),
	"club_callsign" varchar(50),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"lotw_password" varchar(255),
	"lotw_p12_cert" "bytea",
	"lotw_cert_created_at" timestamp,
	"lotw_last_qsl_rcvd_date" date,
	"qrz_last_qsl_rcvd_date" date,
	CONSTRAINT "unique_default_station_per_user" UNIQUE("user_id","is_default")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"station_id" integer,
	"callsign" varchar(50) NOT NULL,
	"name" varchar(255),
	"frequency" numeric(10, 6),
	"mode" varchar(50),
	"band" varchar(20),
	"datetime" timestamp NOT NULL,
	"rst_sent" varchar(10),
	"rst_received" varchar(10),
	"qth" varchar(255),
	"grid_locator" varchar(10),
	"notes" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"country" varchar(100),
	"dxcc" integer,
	"cont" varchar(10),
	"cqz" integer,
	"ituz" integer,
	"state" varchar(50),
	"cnty" varchar(100),
	"qsl_rcvd" varchar(10),
	"qsl_sent" varchar(10),
	"qsl_via" varchar(255),
	"eqsl_qsl_rcvd" varchar(10),
	"eqsl_qsl_sent" varchar(10),
	"lotw_qsl_rcvd" varchar(10),
	"lotw_qsl_sent" varchar(10),
	"qso_date_off" date,
	"time_off" time,
	"operator" varchar(50),
	"distance" numeric(10, 2),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"qsl_lotw" boolean DEFAULT false,
	"qsl_lotw_date" date,
	"lotw_match_status" varchar(20),
	"qrz_qsl_sent" varchar(10),
	"qrz_qsl_rcvd" varchar(10),
	"qrz_qsl_sent_date" date,
	"qrz_qsl_rcvd_date" date,
	"prop_mode" varchar(16),
	"sat_name" varchar(32),
	"band_rx" varchar(20),
	"freq_rx" numeric(10, 6),
	"iota" varchar(16),
	"lotw_qslrdate" date,
	CONSTRAINT "contacts_lotw_match_status_check" CHECK ((lotw_match_status)::text = ANY ((ARRAY['confirmed'::character varying, 'partial'::character varying, 'mismatch'::character varying, NULL::character varying])::text[])),
	CONSTRAINT "contacts_qrz_qsl_sent_check" CHECK ((qrz_qsl_sent IS NULL) OR ((qrz_qsl_sent)::text = ANY ((ARRAY['Y'::character varying, 'N'::character varying, 'R'::character varying, 'M'::character varying, 'I'::character varying, 'Q'::character varying])::text[]))),
	CONSTRAINT "contacts_lotw_qsl_sent_check" CHECK ((lotw_qsl_sent IS NULL) OR ((lotw_qsl_sent)::text = ANY ((ARRAY['Y'::character varying, 'N'::character varying, 'R'::character varying, 'M'::character varying, 'I'::character varying, 'Q'::character varying])::text[])))
);
--> statement-breakpoint
ALTER TABLE "api_key_usage_logs" ADD CONSTRAINT "api_key_usage_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_upload_logs" ADD CONSTRAINT "lotw_upload_logs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_upload_logs" ADD CONSTRAINT "lotw_upload_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_credentials" ADD CONSTRAINT "lotw_credentials_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_download_logs" ADD CONSTRAINT "lotw_download_logs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_download_logs" ADD CONSTRAINT "lotw_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_job_queue" ADD CONSTRAINT "lotw_job_queue_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_job_queue" ADD CONSTRAINT "lotw_job_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_usage_logs_api_key_id" ON "api_key_usage_logs" USING btree ("api_key_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_api_usage_logs_created_at" ON "api_key_usage_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_api_usage_logs_endpoint" ON "api_key_usage_logs" USING btree ("endpoint" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_usage_logs_status_code" ON "api_key_usage_logs" USING btree ("status_code" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_api_key" ON "api_keys" USING btree ("api_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_enabled" ON "api_keys" USING btree ("is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_last_used" ON "api_keys" USING btree ("last_used_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_station_id" ON "api_keys" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_started_at" ON "lotw_upload_logs" USING btree ("started_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_station_id" ON "lotw_upload_logs" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_status" ON "lotw_upload_logs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_user_id" ON "lotw_upload_logs" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_callsign" ON "lotw_credentials" USING btree ("callsign" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_cert_serial" ON "lotw_credentials" USING btree ("cert_serial" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_is_active" ON "lotw_credentials" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_station_id" ON "lotw_credentials" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_download_logs_started_at" ON "lotw_download_logs" USING btree ("started_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_download_logs_station_id" ON "lotw_download_logs" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_download_logs_status" ON "lotw_download_logs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_download_logs_user_id" ON "lotw_download_logs" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_job_queue_is_running" ON "lotw_job_queue" USING btree ("is_running" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_job_queue_job_type" ON "lotw_job_queue" USING btree ("job_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_job_queue_priority" ON "lotw_job_queue" USING btree ("priority" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_job_queue_scheduled_at" ON "lotw_job_queue" USING btree ("scheduled_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_job_queue_station_id" ON "lotw_job_queue" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_job_queue_status" ON "lotw_job_queue" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_callsign" ON "stations" USING btree ("callsign" text_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_is_active" ON "stations" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_is_default" ON "stations" USING btree ("is_default" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_user_id" ON "stations" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_band" ON "contacts" USING btree ("band" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_callsign" ON "contacts" USING btree ("callsign" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_datetime" ON "contacts" USING btree ("datetime" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_frequency" ON "contacts" USING btree ("frequency" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_lotw_match_status" ON "contacts" USING btree ("lotw_match_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_mode" ON "contacts" USING btree ("mode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_prop_mode" ON "contacts" USING btree ("prop_mode" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_qrz_qsl_rcvd" ON "contacts" USING btree ("qrz_qsl_rcvd" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_qrz_qsl_sent" ON "contacts" USING btree ("qrz_qsl_sent" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_qsl_lotw" ON "contacts" USING btree ("qsl_lotw" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_qsl_lotw_date" ON "contacts" USING btree ("qsl_lotw_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_sat_name" ON "contacts" USING btree ("sat_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_station_id" ON "contacts" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_user_id" ON "contacts" USING btree ("user_id" int4_ops);
*/