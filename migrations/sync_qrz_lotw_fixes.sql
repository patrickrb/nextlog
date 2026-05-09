-- Migration: QRZ + LoTW sync correctness fixes
-- Adds fields required to:
--   1. Sign LoTW .tq8 files in pure Node (lotw_credentials.p12_password)
--   2. Track CRL status of stored certificates
--   3. Drive incremental QRZ/LoTW downloads via last-confirmed timestamps
--   4. Carry the cross-service 'M' (modified) and 'I' (ignore) flags
--
-- Idempotent — safe to re-run.
--
-- Prerequisite: postgres-lotw-migration.sql must have been run first to create
-- the lotw_credentials / lotw_upload_logs / lotw_download_logs tables.

-- 0. contacts: ensure QRZ tracking columns exist (some envs were initialized
--    before the in-app /install route added these). sync_qrz_lotw_fixes is the
--    canonical setup for the QRZ flow now.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qrz_qsl_sent      VARCHAR(10);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qrz_qsl_rcvd      VARCHAR(10);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qrz_qsl_sent_date DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qrz_qsl_rcvd_date DATE;
CREATE INDEX IF NOT EXISTS idx_contacts_qrz_qsl_sent ON contacts(qrz_qsl_sent);
CREATE INDEX IF NOT EXISTS idx_contacts_qrz_qsl_rcvd ON contacts(qrz_qsl_rcvd);

-- 1. lotw_credentials: store the encrypted P12 password and CRL state.
ALTER TABLE lotw_credentials ADD COLUMN IF NOT EXISTS p12_password   TEXT;
ALTER TABLE lotw_credentials ADD COLUMN IF NOT EXISTS cert_serial    TEXT;
ALTER TABLE lotw_credentials ADD COLUMN IF NOT EXISTS crl_status     VARCHAR(16);
ALTER TABLE lotw_credentials ADD COLUMN IF NOT EXISTS crl_checked_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_lotw_credentials_cert_serial ON lotw_credentials(cert_serial);

-- 2. stations: incremental download bookmarks.
ALTER TABLE stations ADD COLUMN IF NOT EXISTS lotw_last_qsl_rcvd_date DATE;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS qrz_last_qsl_rcvd_date  DATE;

-- 3. contacts: prop_mode/sat_name/band_rx/freq_rx columns required to build a
--    valid LoTW upload + match satellite confirmations correctly. The mode +
--    band columns already exist; these are the missing TQSL inputs.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS prop_mode VARCHAR(16);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sat_name  VARCHAR(32);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS band_rx   VARCHAR(20);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS freq_rx   DECIMAL(10, 6);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iota      VARCHAR(16);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lotw_qslrdate DATE;
CREATE INDEX IF NOT EXISTS idx_contacts_prop_mode ON contacts(prop_mode);
CREATE INDEX IF NOT EXISTS idx_contacts_sat_name  ON contacts(sat_name);

-- 4. contacts: enforce QRZ/LoTW status enum values (Y/N/R/M/I/Q + NULL).
--    'M' = modified, queued for re-upload after a cross-service confirmation.
--    'I' = ignored, prop_mode is unsupported by LoTW (INTERNET, RPT).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'contacts_qrz_qsl_sent_check'
    ) THEN
        ALTER TABLE contacts
        ADD CONSTRAINT contacts_qrz_qsl_sent_check
        CHECK (qrz_qsl_sent IS NULL OR qrz_qsl_sent IN ('Y','N','R','M','I','Q'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'contacts_lotw_qsl_sent_check'
    ) THEN
        ALTER TABLE contacts
        ADD CONSTRAINT contacts_lotw_qsl_sent_check
        CHECK (lotw_qsl_sent IS NULL OR lotw_qsl_sent IN ('Y','N','R','M','I','Q'));
    END IF;
END$$;

-- 5. stations: ensure DXCC entity / location fields exist (used by .tq8 builder).
ALTER TABLE stations ADD COLUMN IF NOT EXISTS dxcc_entity_code INTEGER;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS state_province  VARCHAR(64);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS county          VARCHAR(64);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS itu_zone        INTEGER;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS cq_zone         INTEGER;

SELECT 'sync_qrz_lotw_fixes migration completed' AS message;
