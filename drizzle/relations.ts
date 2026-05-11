import { relations } from "drizzle-orm/relations";
import { users, stations, storageConfig, apiKeys, adminAuditLog, contacts, qslImages, lotwCredentials, lotwUploadLogs, lotwDownloadLogs, lotwJobQueue, propagationAlerts, userPropagationPreferences, systemSettings } from "./schema";

export const stationsRelations = relations(stations, ({one, many}) => ({
	user: one(users, {
		fields: [stations.userId],
		references: [users.id]
	}),
	apiKeys: many(apiKeys),
	lotwCredentials: many(lotwCredentials),
	lotwUploadLogs: many(lotwUploadLogs),
	lotwDownloadLogs: many(lotwDownloadLogs),
	lotwJobQueues: many(lotwJobQueue),
	contacts: many(contacts),
}));

export const usersRelations = relations(users, ({many}) => ({
	stations: many(stations),
	storageConfigs: many(storageConfig),
	apiKeys: many(apiKeys),
	adminAuditLogs: many(adminAuditLog),
	qslImages: many(qslImages),
	lotwUploadLogs: many(lotwUploadLogs),
	lotwDownloadLogs: many(lotwDownloadLogs),
	lotwJobQueues: many(lotwJobQueue),
	propagationAlerts: many(propagationAlerts),
	userPropagationPreferences: many(userPropagationPreferences),
	contacts: many(contacts),
	systemSettings: many(systemSettings),
}));

export const storageConfigRelations = relations(storageConfig, ({one}) => ({
	user: one(users, {
		fields: [storageConfig.createdBy],
		references: [users.id]
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
	station: one(stations, {
		fields: [apiKeys.stationId],
		references: [stations.id]
	}),
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({one}) => ({
	user: one(users, {
		fields: [adminAuditLog.adminUserId],
		references: [users.id]
	}),
}));

export const qslImagesRelations = relations(qslImages, ({one}) => ({
	contact: one(contacts, {
		fields: [qslImages.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [qslImages.userId],
		references: [users.id]
	}),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	qslImages: many(qslImages),
	user: one(users, {
		fields: [contacts.userId],
		references: [users.id]
	}),
	station: one(stations, {
		fields: [contacts.stationId],
		references: [stations.id]
	}),
}));

export const lotwCredentialsRelations = relations(lotwCredentials, ({one}) => ({
	station: one(stations, {
		fields: [lotwCredentials.stationId],
		references: [stations.id]
	}),
}));

export const lotwUploadLogsRelations = relations(lotwUploadLogs, ({one}) => ({
	station: one(stations, {
		fields: [lotwUploadLogs.stationId],
		references: [stations.id]
	}),
	user: one(users, {
		fields: [lotwUploadLogs.userId],
		references: [users.id]
	}),
}));

export const lotwDownloadLogsRelations = relations(lotwDownloadLogs, ({one}) => ({
	station: one(stations, {
		fields: [lotwDownloadLogs.stationId],
		references: [stations.id]
	}),
	user: one(users, {
		fields: [lotwDownloadLogs.userId],
		references: [users.id]
	}),
}));

export const lotwJobQueueRelations = relations(lotwJobQueue, ({one}) => ({
	station: one(stations, {
		fields: [lotwJobQueue.stationId],
		references: [stations.id]
	}),
	user: one(users, {
		fields: [lotwJobQueue.userId],
		references: [users.id]
	}),
}));

export const propagationAlertsRelations = relations(propagationAlerts, ({one}) => ({
	user: one(users, {
		fields: [propagationAlerts.userId],
		references: [users.id]
	}),
}));

export const userPropagationPreferencesRelations = relations(userPropagationPreferences, ({one}) => ({
	user: one(users, {
		fields: [userPropagationPreferences.userId],
		references: [users.id]
	}),
}));

export const systemSettingsRelations = relations(systemSettings, ({one}) => ({
	user: one(users, {
		fields: [systemSettings.updatedBy],
		references: [users.id]
	}),
}));