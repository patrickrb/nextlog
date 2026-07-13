-- Custom SQL migration file, put your code below! --

-- Drop the orphaned qrz_sync_status_enum type. It was created for a
-- contacts.qrz_sync_status column that never existed in any migration or in
-- drizzle/schema.ts; the code that referenced it wrote to nonexistent columns
-- and has been removed. QRZ sync state lives in the ADIF-style
-- qrz_qsl_sent / qrz_qsl_rcvd columns.
DROP TYPE IF EXISTS "public"."qrz_sync_status_enum";
