import { pgTable, index, unique, check, serial, varchar, boolean, timestamp, jsonb, foreignKey, integer, numeric, text, date, inet, time, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Postgres `bytea` — not first-class in drizzle-orm/pg-core, defined here so
// the p12 cert columns get a real TS type instead of `unknown`.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});



export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	callsign: varchar({ length: 50 }),
	gridLocator: varchar("grid_locator", { length: 10 }),
	qrzUsername: varchar("qrz_username", { length: 255 }),
	qrzPassword: varchar("qrz_password", { length: 255 }),
	qrzAutoSync: boolean("qrz_auto_sync").default(false),
	role: varchar({ length: 50 }).default('user').notNull(),
	status: varchar({ length: 50 }).default('active').notNull(),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	thirdPartyServices: jsonb("third_party_services").default({}),
}, (table) => [
	index("idx_users_callsign").using("btree", table.callsign.asc().nullsLast().op("text_ops")),
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_users_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("idx_users_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("users_email_key").on(table.email),
	check("valid_role", sql`(role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying, 'moderator'::character varying])::text[])`),
	check("valid_status", sql`(status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])`),
]);

export const stations = pgTable("stations", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	callsign: varchar({ length: 50 }).notNull(),
	stationName: varchar("station_name", { length: 255 }).notNull(),
	operatorName: varchar("operator_name", { length: 255 }),
	qthName: varchar("qth_name", { length: 255 }),
	streetAddress: varchar("street_address", { length: 255 }),
	city: varchar({ length: 100 }),
	county: varchar({ length: 100 }),
	stateProvince: varchar("state_province", { length: 100 }),
	postalCode: varchar("postal_code", { length: 20 }),
	country: varchar({ length: 100 }),
	dxccEntityCode: integer("dxcc_entity_code"),
	gridLocator: varchar("grid_locator", { length: 10 }),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	ituZone: integer("itu_zone"),
	cqZone: integer("cq_zone"),
	powerWatts: integer("power_watts"),
	rigInfo: text("rig_info"),
	antennaInfo: text("antenna_info"),
	stationEquipment: text("station_equipment"),
	isActive: boolean("is_active").default(true),
	isDefault: boolean("is_default").default(false),
	qrzUsername: varchar("qrz_username", { length: 255 }),
	qrzPassword: varchar("qrz_password", { length: 255 }),
	qrzApiKey: varchar("qrz_api_key", { length: 255 }),
	qrzAutoSync: boolean("qrz_auto_sync").default(false),
	lotwUsername: varchar("lotw_username", { length: 255 }),
	clubCallsign: varchar("club_callsign", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	lotwPassword: varchar("lotw_password", { length: 255 }),
	lotwP12Cert: bytea("lotw_p12_cert"),
	lotwCertCreatedAt: timestamp("lotw_cert_created_at", { mode: 'string' }),
	lotwLastQslRcvdDate: date("lotw_last_qsl_rcvd_date"),
	qrzLastQslRcvdDate: date("qrz_last_qsl_rcvd_date"),
}, (table) => [
	index("idx_stations_callsign").using("btree", table.callsign.asc().nullsLast().op("text_ops")),
	index("idx_stations_country").using("btree", table.country.asc().nullsLast().op("text_ops")),
	index("idx_stations_dxcc_entity").using("btree", table.dxccEntityCode.asc().nullsLast().op("int4_ops")),
	index("idx_stations_grid_locator").using("btree", table.gridLocator.asc().nullsLast().op("text_ops")),
	index("idx_stations_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_stations_is_default").using("btree", table.isDefault.asc().nullsLast().op("bool_ops")),
	index("idx_stations_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "stations_user_id_fkey"
		}).onDelete("cascade"),
	unique("unique_default_station_per_user").on(table.userId, table.isDefault),
]);

export const dxccEntities = pgTable("dxcc_entities", {
	id: serial().primaryKey().notNull(),
	adif: integer().notNull(),
	name: text().notNull(),
	prefix: text(),
	cqZone: numeric("cq_zone"),
	ituZone: numeric("itu_zone"),
	continent: text(),
	longitude: numeric(),
	latitude: numeric(),
	deleted: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("dxcc_entities_adif_key").on(table.adif),
]);

export const statesProvinces = pgTable("states_provinces", {
	id: serial().primaryKey().notNull(),
	dxccEntity: integer("dxcc_entity").notNull(),
	code: text().notNull(),
	name: text().notNull(),
	type: text(),
	cqZone: text("cq_zone"),
	ituZone: text("itu_zone"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("states_provinces_dxcc_entity_code_key").on(table.dxccEntity, table.code),
]);

export const storageConfig = pgTable("storage_config", {
	id: serial().primaryKey().notNull(),
	configType: varchar("config_type", { length: 50 }).notNull(),
	accountName: varchar("account_name", { length: 255 }),
	accountKey: text("account_key"),
	containerName: varchar("container_name", { length: 255 }),
	endpointUrl: varchar("endpoint_url", { length: 500 }),
	isEnabled: boolean("is_enabled").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	createdBy: integer("created_by"),
}, (table) => [
	index("idx_storage_config_enabled").using("btree", table.isEnabled.asc().nullsLast().op("bool_ops")),
	index("idx_storage_config_type").using("btree", table.configType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "storage_config_created_by_fkey"
		}),
	unique("storage_config_config_type_key").on(table.configType),
	check("valid_config_type", sql`(config_type)::text = ANY ((ARRAY['azure_blob'::character varying, 'aws_s3'::character varying, 'local_storage'::character varying])::text[])`),
]);

export const apiKeys = pgTable("api_keys", {
	id: serial().primaryKey().notNull(),
	stationId: integer("station_id").notNull(),
	userId: integer("user_id").notNull(),
	keyName: varchar("key_name", { length: 255 }).notNull(),
	apiKey: varchar("api_key", { length: 255 }).notNull(),
	keyHash: varchar("key_hash", { length: 255 }).notNull(),
	permissions: jsonb().default({"read":true,"write":false,"delete":false}),
	isActive: boolean("is_active").default(true),
	readOnly: boolean("read_only").default(false),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	usageCount: integer("usage_count").default(0),
	totalRequests: integer("total_requests").default(0),
	rateLimitPerHour: integer("rate_limit_per_hour").default(1000),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_api_keys_api_key").using("btree", table.apiKey.asc().nullsLast().op("text_ops")),
	index("idx_api_keys_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_api_keys_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_api_keys_last_used_at").using("btree", table.lastUsedAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_api_keys_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	index("idx_api_keys_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "api_keys_station_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "api_keys_user_id_fkey"
		}).onDelete("cascade"),
	unique("api_keys_api_key_key").on(table.apiKey),
]);

export const adminAuditLog = pgTable("admin_audit_log", {
	id: serial().primaryKey().notNull(),
	adminUserId: integer("admin_user_id").notNull(),
	action: varchar({ length: 100 }).notNull(),
	targetType: varchar("target_type", { length: 50 }),
	targetId: integer("target_id"),
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_audit_log_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_audit_log_admin_user").using("btree", table.adminUserId.asc().nullsLast().op("int4_ops")),
	index("idx_audit_log_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	// drizzle-kit pull swapped the opclasses (target_type is varchar, target_id is integer).
	index("idx_audit_log_target").using("btree", table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.adminUserId],
			foreignColumns: [users.id],
			name: "admin_audit_log_admin_user_id_fkey"
		}),
]);

export const qslImages = pgTable("qsl_images", {
	id: serial().primaryKey().notNull(),
	contactId: integer("contact_id").notNull(),
	userId: integer("user_id").notNull(),
	imageType: varchar("image_type", { length: 10 }).notNull(),
	filename: varchar({ length: 255 }).notNull(),
	originalFilename: varchar("original_filename", { length: 255 }).notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: varchar("mime_type", { length: 100 }).notNull(),
	storagePath: varchar("storage_path", { length: 500 }).notNull(),
	storageUrl: varchar("storage_url", { length: 500 }),
	storageType: varchar("storage_type", { length: 20 }).default('azure_blob'),
	width: integer(),
	height: integer(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_qsl_images_contact_id").using("btree", table.contactId.asc().nullsLast().op("int4_ops")),
	index("idx_qsl_images_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_qsl_images_type").using("btree", table.imageType.asc().nullsLast().op("text_ops")),
	index("idx_qsl_images_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "qsl_images_contact_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "qsl_images_user_id_fkey"
		}).onDelete("cascade"),
	unique("qsl_images_contact_id_image_type_key").on(table.contactId, table.imageType),
	check("qsl_images_image_type_check", sql`(image_type)::text = ANY ((ARRAY['front'::character varying, 'back'::character varying])::text[])`),
	check("qsl_images_mime_type_check", sql`(mime_type)::text = ANY ((ARRAY['image/jpeg'::character varying, 'image/jpg'::character varying, 'image/png'::character varying, 'image/webp'::character varying])::text[])`),
	check("qsl_images_storage_type_check", sql`(storage_type)::text = ANY ((ARRAY['azure_blob'::character varying, 'aws_s3'::character varying, 'local_storage'::character varying])::text[])`),
]);

export const lotwCredentials = pgTable("lotw_credentials", {
	id: serial().primaryKey().notNull(),
	stationId: integer("station_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	callsign: varchar({ length: 50 }).notNull(),
	p12Cert: bytea("p12_cert").notNull(),
	certCreatedAt: timestamp("cert_created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	certExpiresAt: timestamp("cert_expires_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	p12Password: text("p12_password"),
	certSerial: text("cert_serial"),
	crlStatus: varchar("crl_status", { length: 16 }),
	crlCheckedAt: timestamp("crl_checked_at", { mode: 'string' }),
}, (table) => [
	index("idx_lotw_credentials_callsign").using("btree", table.callsign.asc().nullsLast().op("text_ops")),
	index("idx_lotw_credentials_cert_serial").using("btree", table.certSerial.asc().nullsLast().op("text_ops")),
	index("idx_lotw_credentials_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_lotw_credentials_station_active").using("btree", table.stationId.asc().nullsLast().op("int4_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_lotw_credentials_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "lotw_credentials_station_id_fkey"
		}).onDelete("cascade"),
]);

export const lotwUploadLogs = pgTable("lotw_upload_logs", {
	id: serial().primaryKey().notNull(),
	stationId: integer("station_id").notNull(),
	userId: integer("user_id").notNull(),
	qsoCount: integer("qso_count").default(0).notNull(),
	dateFrom: date("date_from"),
	dateTo: date("date_to"),
	fileHash: varchar("file_hash", { length: 64 }),
	fileSizeBytes: integer("file_size_bytes"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	successCount: integer("success_count").default(0),
	errorCount: integer("error_count").default(0),
	errorMessage: text("error_message"),
	lotwResponse: text("lotw_response"),
	uploadMethod: varchar("upload_method", { length: 20 }).default('manual'),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_lotw_upload_logs_started_at").using("btree", table.startedAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_lotw_upload_logs_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	index("idx_lotw_upload_logs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_lotw_upload_logs_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "lotw_upload_logs_station_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "lotw_upload_logs_user_id_fkey"
		}).onDelete("cascade"),
	check("lotw_upload_logs_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])`),
	check("lotw_upload_logs_upload_method_check", sql`(upload_method)::text = ANY ((ARRAY['manual'::character varying, 'automatic'::character varying, 'scheduled'::character varying])::text[])`),
]);

export const lotwDownloadLogs = pgTable("lotw_download_logs", {
	id: serial().primaryKey().notNull(),
	stationId: integer("station_id").notNull(),
	userId: integer("user_id").notNull(),
	dateFrom: date("date_from"),
	dateTo: date("date_to"),
	qsoCount: integer("qso_count").default(0),
	status: varchar({ length: 20 }).default('pending').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	confirmationsFound: integer("confirmations_found").default(0),
	confirmationsMatched: integer("confirmations_matched").default(0),
	confirmationsUnmatched: integer("confirmations_unmatched").default(0),
	errorMessage: text("error_message"),
	downloadMethod: varchar("download_method", { length: 20 }).default('manual'),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_lotw_download_logs_started_at").using("btree", table.startedAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_lotw_download_logs_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	index("idx_lotw_download_logs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_lotw_download_logs_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "lotw_download_logs_station_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "lotw_download_logs_user_id_fkey"
		}).onDelete("cascade"),
	check("lotw_download_logs_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])`),
	check("lotw_download_logs_download_method_check", sql`(download_method)::text = ANY ((ARRAY['manual'::character varying, 'automatic'::character varying, 'scheduled'::character varying])::text[])`),
]);

// Unified sync activity log. QRZ writes here today; 'lotw' and 'eqsl' are
// reserved (LoTW keeps its dedicated lotw_upload_logs / lotw_download_logs;
// the /api/sync/logs feed merges them into one view).
export const syncLogs = pgTable("sync_logs", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stationId: integer("station_id"),
	service: varchar({ length: 10 }).notNull(),
	direction: varchar({ length: 10 }).notNull(),
	trigger: varchar({ length: 10 }).notNull(),
	status: varchar({ length: 12 }).notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	qsoCount: integer("qso_count").default(0),
	successCount: integer("success_count").default(0),
	matchedCount: integer("matched_count").default(0),
	errorMessage: text("error_message"),
	details: jsonb(),
}, (table) => [
	index("idx_sync_logs_user_started").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.startedAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_sync_logs_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sync_logs_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "sync_logs_station_id_fkey"
		}).onDelete("cascade"),
	check("sync_logs_service_check", sql`(service)::text = ANY ((ARRAY['qrz'::character varying, 'lotw'::character varying, 'eqsl'::character varying])::text[])`),
	check("sync_logs_direction_check", sql`(direction)::text = ANY ((ARRAY['upload'::character varying, 'download'::character varying])::text[])`),
	check("sync_logs_trigger_check", sql`(trigger)::text = ANY ((ARRAY['manual'::character varying, 'auto'::character varying, 'cron'::character varying])::text[])`),
	check("sync_logs_status_check", sql`(status)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying])::text[])`),
]);

export const lotwJobQueue = pgTable("lotw_job_queue", {
	id: serial().primaryKey().notNull(),
	jobType: varchar("job_type", { length: 20 }).notNull(),
	stationId: integer("station_id").notNull(),
	userId: integer("user_id").notNull(),
	jobParams: jsonb("job_params"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	isRunning: boolean("is_running").default(false),
	scheduledAt: timestamp("scheduled_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	attempts: integer().default(0),
	maxAttempts: integer("max_attempts").default(3),
	errorMessage: text("error_message"),
	result: jsonb(),
	priority: integer().default(5),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_lotw_job_queue_is_running").using("btree", table.isRunning.asc().nullsLast().op("bool_ops")),
	index("idx_lotw_job_queue_job_type").using("btree", table.jobType.asc().nullsLast().op("text_ops")),
	index("idx_lotw_job_queue_priority").using("btree", table.priority.asc().nullsLast().op("int4_ops")),
	index("idx_lotw_job_queue_scheduled_at").using("btree", table.scheduledAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_lotw_job_queue_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	index("idx_lotw_job_queue_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "lotw_job_queue_station_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "lotw_job_queue_user_id_fkey"
		}).onDelete("cascade"),
	check("lotw_job_queue_job_type_check", sql`(job_type)::text = ANY ((ARRAY['upload'::character varying, 'download'::character varying])::text[])`),
	check("lotw_job_queue_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])`),
]);

export const propagationForecasts = pgTable("propagation_forecasts", {
	id: serial().primaryKey().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	forecastFor: timestamp("forecast_for", { mode: 'string' }).notNull(),
	bandConditions: jsonb("band_conditions").notNull(),
	generalConditions: varchar("general_conditions", { length: 20 }).notNull(),
	notes: text(),
	source: varchar({ length: 50 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_propagation_forecasts_forecast_for").using("btree", table.forecastFor.desc().nullsFirst().op("timestamp_ops")),
	index("idx_propagation_forecasts_timestamp").using("btree", table.timestamp.desc().nullsFirst().op("timestamp_ops")),
	check("propagation_forecasts_general_conditions_check", sql`(general_conditions)::text = ANY ((ARRAY['poor'::character varying, 'fair'::character varying, 'good'::character varying, 'excellent'::character varying])::text[])`),
	check("valid_general_conditions", sql`(general_conditions)::text = ANY ((ARRAY['poor'::character varying, 'fair'::character varying, 'good'::character varying, 'excellent'::character varying])::text[])`),
]);

export const propagationAlerts = pgTable("propagation_alerts", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	alertType: varchar("alert_type", { length: 30 }).notNull(),
	severity: varchar({ length: 10 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	isActive: boolean("is_active").default(true),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_propagation_alerts_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_propagation_alerts_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")).where(sql`(expires_at IS NOT NULL)`),
	index("idx_propagation_alerts_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "propagation_alerts_user_id_fkey"
		}).onDelete("cascade"),
	check("propagation_alerts_alert_type_check", sql`(alert_type)::text = ANY ((ARRAY['solar_storm'::character varying, 'enhanced_propagation'::character varying, 'band_opening'::character varying, 'aurora'::character varying])::text[])`),
	check("propagation_alerts_severity_check", sql`(severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])`),
	check("valid_alert_type", sql`(alert_type)::text = ANY ((ARRAY['solar_storm'::character varying, 'enhanced_propagation'::character varying, 'band_opening'::character varying, 'aurora'::character varying])::text[])`),
	check("valid_severity", sql`(severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])`),
]);

export const userPropagationPreferences = pgTable("user_propagation_preferences", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	homeGridLocator: varchar("home_grid_locator", { length: 10 }),
	preferredBands: text("preferred_bands").array(),
	alertSolarStorms: boolean("alert_solar_storms").default(true),
	alertEnhancedPropagation: boolean("alert_enhanced_propagation").default(true),
	alertBandOpenings: boolean("alert_band_openings").default(false),
	alertAurora: boolean("alert_aurora").default(false),
	updateIntervalMinutes: integer("update_interval_minutes").default(60),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_propagation_preferences_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_propagation_preferences_user_id_key").on(table.userId),
	check("user_propagation_preferences_update_interval_minutes_check", sql`update_interval_minutes >= 15`),
]);

export const solarActivity = pgTable("solar_activity", {
	id: serial().primaryKey().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	solarFluxIndex: numeric("solar_flux_index", { precision: 6, scale:  2 }).notNull(),
	aIndex: numeric("a_index", { precision: 5, scale:  2 }).notNull(),
	kIndex: numeric("k_index", { precision: 3, scale:  1 }).notNull(),
	solarWindSpeed: numeric("solar_wind_speed", { precision: 7, scale:  2 }),
	solarWindDensity: numeric("solar_wind_density", { precision: 6, scale:  3 }),
	xrayClass: varchar("xray_class", { length: 5 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_solar_activity_timestamp").using("btree", table.timestamp.desc().nullsFirst().op("timestamp_ops")),
	unique("solar_activity_timestamp_key").on(table.timestamp),
]);

export const contacts = pgTable("contacts", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stationId: integer("station_id"),
	callsign: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 255 }),
	frequency: numeric({ precision: 10, scale:  6 }),
	mode: varchar({ length: 50 }),
	band: varchar({ length: 20 }),
	datetime: timestamp({ mode: 'string' }).notNull(),
	rstSent: varchar("rst_sent", { length: 10 }),
	rstReceived: varchar("rst_received", { length: 10 }),
	qth: varchar({ length: 255 }),
	gridLocator: varchar("grid_locator", { length: 10 }),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	country: varchar({ length: 100 }),
	dxcc: integer(),
	cont: varchar({ length: 10 }),
	cqz: integer(),
	ituz: integer(),
	state: varchar({ length: 50 }),
	cnty: varchar({ length: 100 }),
	qslRcvd: varchar("qsl_rcvd", { length: 10 }),
	qslSent: varchar("qsl_sent", { length: 10 }),
	qslVia: varchar("qsl_via", { length: 255 }),
	eqslQslRcvd: varchar("eqsl_qsl_rcvd", { length: 10 }),
	eqslQslSent: varchar("eqsl_qsl_sent", { length: 10 }),
	lotwQslRcvd: varchar("lotw_qsl_rcvd", { length: 10 }),
	lotwQslSent: varchar("lotw_qsl_sent", { length: 10 }),
	qrzQslSent: varchar("qrz_qsl_sent", { length: 10 }),
	qrzQslRcvd: varchar("qrz_qsl_rcvd", { length: 10 }),
	qrzQslSentDate: date("qrz_qsl_sent_date"),
	qrzQslRcvdDate: date("qrz_qsl_rcvd_date"),
	qsoDateOff: date("qso_date_off"),
	timeOff: time("time_off"),
	operator: varchar({ length: 50 }),
	distance: numeric({ precision: 10, scale:  2 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	qslLotw: boolean("qsl_lotw").default(false),
	qslLotwDate: date("qsl_lotw_date"),
	lotwMatchStatus: varchar("lotw_match_status", { length: 20 }),
	propMode: varchar("prop_mode", { length: 16 }),
	satName: varchar("sat_name", { length: 32 }),
	bandRx: varchar("band_rx", { length: 20 }),
	freqRx: numeric("freq_rx", { precision: 10, scale:  6 }),
	iota: varchar({ length: 16 }),
	lotwQslrdate: date("lotw_qslrdate"),
}, (table) => [
	index("idx_contacts_band").using("btree", table.band.asc().nullsLast().op("text_ops")),
	index("idx_contacts_callsign").using("btree", table.callsign.asc().nullsLast().op("text_ops")),
	index("idx_contacts_datetime").using("btree", table.datetime.desc().nullsFirst().op("timestamp_ops")),
	index("idx_contacts_frequency").using("btree", table.frequency.asc().nullsLast().op("numeric_ops")),
	index("idx_contacts_lotw_match_status").using("btree", table.lotwMatchStatus.asc().nullsLast().op("text_ops")),
	index("idx_contacts_mode").using("btree", table.mode.asc().nullsLast().op("text_ops")),
	index("idx_contacts_prop_mode").using("btree", table.propMode.asc().nullsLast().op("text_ops")),
	index("idx_contacts_qrz_qsl_rcvd").using("btree", table.qrzQslRcvd.asc().nullsLast().op("text_ops")),
	index("idx_contacts_qrz_qsl_sent").using("btree", table.qrzQslSent.asc().nullsLast().op("text_ops")),
	index("idx_contacts_qsl_lotw").using("btree", table.qslLotw.asc().nullsLast().op("bool_ops")),
	index("idx_contacts_qsl_lotw_date").using("btree", table.qslLotwDate.asc().nullsLast().op("date_ops")),
	index("idx_contacts_sat_name").using("btree", table.satName.asc().nullsLast().op("text_ops")),
	index("idx_contacts_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	index("idx_contacts_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "contacts_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "contacts_station_id_fkey"
		}).onDelete("set null"),
	check("contacts_lotw_match_status_check", sql`(lotw_match_status)::text = ANY ((ARRAY['confirmed'::character varying, 'partial'::character varying, 'mismatch'::character varying, NULL::character varying])::text[])`),
	check("contacts_qrz_qsl_sent_check", sql`(qrz_qsl_sent IS NULL) OR ((qrz_qsl_sent)::text = ANY ((ARRAY['Y'::character varying, 'N'::character varying, 'R'::character varying, 'M'::character varying, 'I'::character varying, 'Q'::character varying])::text[]))`),
	check("contacts_lotw_qsl_sent_check", sql`(lotw_qsl_sent IS NULL) OR ((lotw_qsl_sent)::text = ANY ((ARRAY['Y'::character varying, 'N'::character varying, 'R'::character varying, 'M'::character varying, 'I'::character varying, 'Q'::character varying])::text[]))`),
]);

export const systemSettings = pgTable("system_settings", {
	id: serial().primaryKey().notNull(),
	settingKey: varchar("setting_key", { length: 255 }).notNull(),
	settingValue: text("setting_value").notNull(),
	dataType: varchar("data_type", { length: 50 }).default('string').notNull(),
	category: varchar({ length: 100 }).default('general').notNull(),
	description: text(),
	isPublic: boolean("is_public").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedBy: integer("updated_by"),
}, (table) => [
	index("idx_system_settings_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_system_settings_key").using("btree", table.settingKey.asc().nullsLast().op("text_ops")),
	index("idx_system_settings_public").using("btree", table.isPublic.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "system_settings_updated_by_fkey"
		}),
	unique("system_settings_setting_key_key").on(table.settingKey),
]);
