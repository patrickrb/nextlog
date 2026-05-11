import { pgTable, index, foreignKey, serial, integer, varchar, inet, text, timestamp, unique, check, boolean, date, jsonb, numeric, time, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Postgres `bytea` — not first-class in drizzle-orm/pg-core, defined here so
// the introspected p12 cert columns get a real TS type instead of `unknown`.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});



export const apiKeyUsageLogs = pgTable("api_key_usage_logs", {
	id: serial().primaryKey().notNull(),
	apiKeyId: integer("api_key_id").notNull(),
	endpoint: varchar({ length: 255 }).notNull(),
	method: varchar({ length: 10 }).notNull(),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	statusCode: integer("status_code").notNull(),
	responseTimeMs: integer("response_time_ms"),
	bytesSent: integer("bytes_sent"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	errorMessage: text("error_message"),
}, (table) => [
	index("idx_api_usage_logs_api_key_id").using("btree", table.apiKeyId.asc().nullsLast().op("int4_ops")),
	index("idx_api_usage_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_api_usage_logs_endpoint").using("btree", table.endpoint.asc().nullsLast().op("text_ops")),
	index("idx_api_usage_logs_status_code").using("btree", table.statusCode.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKeys.id],
			name: "api_key_usage_logs_api_key_id_fkey"
		}).onDelete("cascade"),
]);

export const apiKeys = pgTable("api_keys", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stationId: integer("station_id"),
	keyName: varchar("key_name", { length: 255 }).notNull(),
	apiKey: varchar("api_key", { length: 255 }).notNull(),
	apiSecret: varchar("api_secret", { length: 255 }).notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	readOnly: boolean("read_only").default(false).notNull(),
	allowedEndpoints: text("allowed_endpoints").array(),
	rateLimitPerHour: integer("rate_limit_per_hour").default(1000),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	totalRequests: integer("total_requests").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
}, (table) => [
	index("idx_api_keys_api_key").using("btree", table.apiKey.asc().nullsLast().op("text_ops")),
	index("idx_api_keys_enabled").using("btree", table.isEnabled.asc().nullsLast().op("bool_ops")),
	index("idx_api_keys_last_used").using("btree", table.lastUsedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_api_keys_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	index("idx_api_keys_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "api_keys_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "api_keys_station_id_fkey"
		}).onDelete("cascade"),
	unique("unique_user_key_name").on(table.userId, table.keyName),
	unique("api_keys_api_key_key").on(table.apiKey),
	check("check_api_key_format", sql`CHECK (is_valid_api_key_format((api_key)::text`),
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

export const lotwCredentials = pgTable("lotw_credentials", {
	id: serial().primaryKey().notNull(),
	stationId: integer("station_id").notNull(),
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
	index("idx_lotw_credentials_station_id").using("btree", table.stationId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stationId],
			foreignColumns: [stations.id],
			name: "lotw_credentials_station_id_fkey"
		}).onDelete("cascade"),
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

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	callsign: varchar({ length: 50 }),
	gridLocator: varchar("grid_locator", { length: 10 }),
	qrzUsername: varchar("qrz_username", { length: 255 }),
	qrzPassword: varchar("qrz_password", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	thirdPartyServices: jsonb("third_party_services").default({}),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("users_email_key").on(table.email),
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
	notes: text(),
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
	qsoDateOff: date("qso_date_off"),
	timeOff: time("time_off"),
	operator: varchar({ length: 50 }),
	distance: numeric({ precision: 10, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	qslLotw: boolean("qsl_lotw").default(false),
	qslLotwDate: date("qsl_lotw_date"),
	lotwMatchStatus: varchar("lotw_match_status", { length: 20 }),
	qrzQslSent: varchar("qrz_qsl_sent", { length: 10 }),
	qrzQslRcvd: varchar("qrz_qsl_rcvd", { length: 10 }),
	qrzQslSentDate: date("qrz_qsl_sent_date"),
	qrzQslRcvdDate: date("qrz_qsl_rcvd_date"),
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
