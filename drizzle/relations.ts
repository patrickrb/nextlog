import { relations } from "drizzle-orm/relations";
import { apiKeys, apiKeyUsageLogs, users, stations, lotwUploadLogs, lotwCredentials, lotwDownloadLogs, lotwJobQueue, contacts } from "./schema";

export const apiKeyUsageLogsRelations = relations(apiKeyUsageLogs, ({one}) => ({
	apiKey: one(apiKeys, {
		fields: [apiKeyUsageLogs.apiKeyId],
		references: [apiKeys.id]
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one, many}) => ({
	apiKeyUsageLogs: many(apiKeyUsageLogs),
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
	station: one(stations, {
		fields: [apiKeys.stationId],
		references: [stations.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	apiKeys: many(apiKeys),
	lotwUploadLogs: many(lotwUploadLogs),
	lotwDownloadLogs: many(lotwDownloadLogs),
	lotwJobQueues: many(lotwJobQueue),
	stations: many(stations),
	contacts: many(contacts),
}));

export const stationsRelations = relations(stations, ({one, many}) => ({
	apiKeys: many(apiKeys),
	lotwUploadLogs: many(lotwUploadLogs),
	lotwCredentials: many(lotwCredentials),
	lotwDownloadLogs: many(lotwDownloadLogs),
	lotwJobQueues: many(lotwJobQueue),
	user: one(users, {
		fields: [stations.userId],
		references: [users.id]
	}),
	contacts: many(contacts),
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

export const lotwCredentialsRelations = relations(lotwCredentials, ({one}) => ({
	station: one(stations, {
		fields: [lotwCredentials.stationId],
		references: [stations.id]
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

export const contactsRelations = relations(contacts, ({one}) => ({
	user: one(users, {
		fields: [contacts.userId],
		references: [users.id]
	}),
	station: one(stations, {
		fields: [contacts.stationId],
		references: [stations.id]
	}),
}));