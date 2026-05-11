CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" integer,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"key_name" varchar(255) NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"permissions" jsonb DEFAULT '{"read":true,"write":false,"delete":false}'::jsonb,
	"is_active" boolean DEFAULT true,
	"read_only" boolean DEFAULT false,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"total_requests" integer DEFAULT 0,
	"rate_limit_per_hour" integer DEFAULT 1000,
	"expires_at" timestamp,
	"description" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "api_keys_api_key_key" UNIQUE("api_key")
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
	"qrz_qsl_sent" varchar(10),
	"qrz_qsl_rcvd" varchar(10),
	"qrz_qsl_sent_date" date,
	"qrz_qsl_rcvd_date" date,
	"qso_date_off" date,
	"time_off" time,
	"operator" varchar(50),
	"distance" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"qsl_lotw" boolean DEFAULT false,
	"qsl_lotw_date" date,
	"lotw_match_status" varchar(20),
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
CREATE TABLE "dxcc_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"adif" integer NOT NULL,
	"name" text NOT NULL,
	"prefix" text,
	"cq_zone" numeric,
	"itu_zone" numeric,
	"continent" text,
	"longitude" numeric,
	"latitude" numeric,
	"deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "lotw_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
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
CREATE TABLE "propagation_alerts" (
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
CREATE TABLE "propagation_forecasts" (
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
CREATE TABLE "qsl_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"image_type" varchar(10) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"storage_url" varchar(500),
	"storage_type" varchar(20) DEFAULT 'azure_blob',
	"width" integer,
	"height" integer,
	"description" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "qsl_images_contact_id_image_type_key" UNIQUE("contact_id","image_type"),
	CONSTRAINT "qsl_images_image_type_check" CHECK ((image_type)::text = ANY ((ARRAY['front'::character varying, 'back'::character varying])::text[])),
	CONSTRAINT "qsl_images_mime_type_check" CHECK ((mime_type)::text = ANY ((ARRAY['image/jpeg'::character varying, 'image/jpg'::character varying, 'image/png'::character varying, 'image/webp'::character varying])::text[])),
	CONSTRAINT "qsl_images_storage_type_check" CHECK ((storage_type)::text = ANY ((ARRAY['azure_blob'::character varying, 'aws_s3'::character varying, 'local_storage'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "solar_activity" (
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
CREATE TABLE "states_provinces" (
	"id" serial PRIMARY KEY NOT NULL,
	"dxcc_entity" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"cq_zone" text,
	"itu_zone" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
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
	"qrz_api_key" varchar(255),
	"qrz_auto_sync" boolean DEFAULT false,
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
CREATE TABLE "storage_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_type" varchar(50) NOT NULL,
	"account_name" varchar(255),
	"account_key" text,
	"container_name" varchar(255),
	"endpoint_url" varchar(500),
	"is_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"created_by" integer,
	CONSTRAINT "storage_config_config_type_key" UNIQUE("config_type"),
	CONSTRAINT "valid_config_type" CHECK ((config_type)::text = ANY ((ARRAY['azure_blob'::character varying, 'aws_s3'::character varying, 'local_storage'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" varchar(255) NOT NULL,
	"setting_value" text NOT NULL,
	"data_type" varchar(50) DEFAULT 'string' NOT NULL,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_by" integer,
	CONSTRAINT "system_settings_setting_key_key" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "user_propagation_preferences" (
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
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"callsign" varchar(50),
	"grid_locator" varchar(10),
	"qrz_username" varchar(255),
	"qrz_password" varchar(255),
	"qrz_auto_sync" boolean DEFAULT false,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"third_party_services" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "valid_role" CHECK ((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying, 'moderator'::character varying])::text[])),
	CONSTRAINT "valid_status" CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[]))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_credentials" ADD CONSTRAINT "lotw_credentials_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_download_logs" ADD CONSTRAINT "lotw_download_logs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_download_logs" ADD CONSTRAINT "lotw_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_job_queue" ADD CONSTRAINT "lotw_job_queue_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_job_queue" ADD CONSTRAINT "lotw_job_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_upload_logs" ADD CONSTRAINT "lotw_upload_logs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotw_upload_logs" ADD CONSTRAINT "lotw_upload_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propagation_alerts" ADD CONSTRAINT "propagation_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qsl_images" ADD CONSTRAINT "qsl_images_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qsl_images" ADD CONSTRAINT "qsl_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_config" ADD CONSTRAINT "storage_config_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_propagation_preferences" ADD CONSTRAINT "user_propagation_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "admin_audit_log" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_log_admin_user" ON "admin_audit_log" USING btree ("admin_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "admin_audit_log" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_log_target" ON "admin_audit_log" USING btree ("target_type" int4_ops,"target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_api_key" ON "api_keys" USING btree ("api_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_expires_at" ON "api_keys" USING btree ("expires_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_is_active" ON "api_keys" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_last_used_at" ON "api_keys" USING btree ("last_used_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_station_id" ON "api_keys" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id" int4_ops);--> statement-breakpoint
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
CREATE INDEX "idx_contacts_user_id" ON "contacts" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_callsign" ON "lotw_credentials" USING btree ("callsign" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_cert_serial" ON "lotw_credentials" USING btree ("cert_serial" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_is_active" ON "lotw_credentials" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_credentials_station_active" ON "lotw_credentials" USING btree ("station_id" int4_ops,"is_active" bool_ops);--> statement-breakpoint
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
CREATE INDEX "idx_lotw_upload_logs_started_at" ON "lotw_upload_logs" USING btree ("started_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_station_id" ON "lotw_upload_logs" USING btree ("station_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_status" ON "lotw_upload_logs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lotw_upload_logs_user_id" ON "lotw_upload_logs" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_propagation_alerts_active" ON "propagation_alerts" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_propagation_alerts_expires" ON "propagation_alerts" USING btree ("expires_at" timestamp_ops) WHERE (expires_at IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_propagation_alerts_user_id" ON "propagation_alerts" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_propagation_forecasts_forecast_for" ON "propagation_forecasts" USING btree ("forecast_for" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_propagation_forecasts_timestamp" ON "propagation_forecasts" USING btree ("timestamp" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_qsl_images_contact_id" ON "qsl_images" USING btree ("contact_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_qsl_images_created_at" ON "qsl_images" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_qsl_images_type" ON "qsl_images" USING btree ("image_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_qsl_images_user_id" ON "qsl_images" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_solar_activity_timestamp" ON "solar_activity" USING btree ("timestamp" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_callsign" ON "stations" USING btree ("callsign" text_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_country" ON "stations" USING btree ("country" text_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_dxcc_entity" ON "stations" USING btree ("dxcc_entity_code" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_grid_locator" ON "stations" USING btree ("grid_locator" text_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_is_active" ON "stations" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_is_default" ON "stations" USING btree ("is_default" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_stations_user_id" ON "stations" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_storage_config_enabled" ON "storage_config" USING btree ("is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_storage_config_type" ON "storage_config" USING btree ("config_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_system_settings_category" ON "system_settings" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_system_settings_key" ON "system_settings" USING btree ("setting_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_system_settings_public" ON "system_settings" USING btree ("is_public" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_users_callsign" ON "users" USING btree ("callsign" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status" text_ops);