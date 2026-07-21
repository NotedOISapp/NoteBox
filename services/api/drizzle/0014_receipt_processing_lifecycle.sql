ALTER TYPE "scan_status" ADD VALUE IF NOT EXISTS 'unavailable';

DO $$ BEGIN
  CREATE TYPE "receipt_processing_job_type" AS ENUM ('scan', 'ocr');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "receipt_processing_job_status" AS ENUM ('pending', 'processing', 'succeeded', 'rejected', 'unavailable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- OCR is one canonical derived record per Receipt. Keep the newest legacy row
-- before applying the invariant so the migration never chooses arbitrarily.
DELETE FROM "ocr_texts" older
USING "ocr_texts" newer
WHERE older."receipt_id" = newer."receipt_id"
  AND (older."created_at", older."id") < (newer."created_at", newer."id");

ALTER TABLE "ocr_texts"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ocr_texts_receipt_id_unique"
  ON "ocr_texts" ("receipt_id");

CREATE TABLE IF NOT EXISTS "receipt_processing_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "receipt_id" uuid NOT NULL REFERENCES "receipts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "job_type" "receipt_processing_job_type" NOT NULL,
  "status" "receipt_processing_job_status" DEFAULT 'pending' NOT NULL,
  "storage_key" text NOT NULL,
  "expected_object_version" text,
  "expected_sha256" text,
  "expected_content_type" text NOT NULL,
  "expected_size_bytes" bigint NOT NULL,
  "provider" text,
  "provider_reference" text,
  "failure_code" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp,
  "claimed_by" text,
  "claim_token" uuid,
  "lease_expires_at" timestamp,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "receipt_processing_jobs_attempt_count_check" CHECK ("attempt_count" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "receipt_processing_jobs_receipt_type_unique"
  ON "receipt_processing_jobs" ("receipt_id", "job_type");
CREATE INDEX IF NOT EXISTS "receipt_processing_jobs_claim_idx"
  ON "receipt_processing_jobs" ("status", "next_attempt_at", "lease_expires_at");
CREATE INDEX IF NOT EXISTS "receipt_processing_jobs_user_id_idx"
  ON "receipt_processing_jobs" ("user_id");

-- Existing confirmed uploads must enter the same durable producer path.
INSERT INTO "receipt_processing_jobs" (
  "receipt_id", "user_id", "job_type", "status", "storage_key",
  "expected_object_version", "expected_sha256", "expected_content_type", "expected_size_bytes"
)
SELECT
  r."id", r."user_id", 'scan', 'pending', r."storage_key",
  NULL, NULLIF(r."sha256", ''), r."content_type", r."size_bytes"
FROM "receipts" r
WHERE r."scan_status" = 'pending'
ON CONFLICT ("receipt_id", "job_type") DO NOTHING;

ALTER TABLE "receipt_processing_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_processing_jobs_policy ON "receipt_processing_jobs" FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- The cron worker uses a dedicated database session and sets this local
-- context flag. This makes non-owner worker roles explicit instead of relying
-- on table-owner RLS bypass.
CREATE POLICY receipt_processing_jobs_worker_policy ON "receipt_processing_jobs" FOR ALL
  USING (current_setting('app.receipt_worker', true) = 'true')
  WITH CHECK (current_setting('app.receipt_worker', true) = 'true');
CREATE POLICY receipts_worker_policy ON "receipts" FOR ALL
  USING (current_setting('app.receipt_worker', true) = 'true')
  WITH CHECK (current_setting('app.receipt_worker', true) = 'true');
CREATE POLICY ocr_texts_worker_policy ON "ocr_texts" FOR ALL
  USING (current_setting('app.receipt_worker', true) = 'true')
  WITH CHECK (current_setting('app.receipt_worker', true) = 'true');
CREATE POLICY privacy_preferences_worker_policy ON "privacy_preferences" FOR SELECT
  USING (current_setting('app.receipt_worker', true) = 'true');
