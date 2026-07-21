-- Migration 0010: Promotional security hardening.
-- This migration is safe for a fresh database and for a database at 0009.

CREATE TABLE IF NOT EXISTS "storekit_transaction_tombstones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" text NOT NULL,
  "original_transaction_id" text,
  "product_id" text NOT NULL,
  "environment" text NOT NULL,
  "transaction_status" text NOT NULL,
  "effective_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "storekit_transaction_tombstones_transaction_id_unique" UNIQUE("transaction_id")
);

CREATE TABLE IF NOT EXISTS "app_store_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "notification_uuid" text NOT NULL,
  "notification_type" text NOT NULL,
  "subtype" text,
  "environment" text NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  "processing_status" text DEFAULT 'received' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp,
  "failure_code" text,
  "signed_date" timestamp,
  "processing_started_at" timestamp,
  "processing_lease_expires_at" timestamp,
  CONSTRAINT "app_store_notifications_notification_uuid_unique" UNIQUE("notification_uuid"),
  CONSTRAINT "app_store_notifications_status_check"
    CHECK ("processing_status" IN ('received', 'processing', 'processed', 'failed', 'ignored'))
);

CREATE TABLE IF NOT EXISTS "upload_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "max_size_bytes" bigint NOT NULL,
  "expected_content_type" text NOT NULL,
  "expected_sha256" text,
  "provider_object_version" text,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "confirmed_receipt_id" uuid REFERENCES "receipts"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "upload_reservations_storage_key_unique" UNIQUE("storage_key"),
  CONSTRAINT "upload_reservations_max_size_positive" CHECK ("max_size_bytes" > 0)
);
CREATE INDEX IF NOT EXISTS "upload_reservations_user_id_idx" ON "upload_reservations" ("user_id");
CREATE INDEX IF NOT EXISTS "upload_reservations_note_id_idx" ON "upload_reservations" ("note_id");
CREATE INDEX IF NOT EXISTS "upload_reservations_expires_at_idx" ON "upload_reservations" ("expires_at");

-- StoreKit anti-replay rows survive account deletion, but ownership is detached.
ALTER TABLE "storekit_transactions" DROP CONSTRAINT IF EXISTS "storekit_transactions_user_id_users_id_fk";
ALTER TABLE "storekit_transactions" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "storekit_transactions"
  ADD CONSTRAINT "storekit_transactions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "promotional_grants"
  ADD COLUMN IF NOT EXISTS "approval_id" uuid REFERENCES "creator_reward_approvals"("id") ON DELETE SET NULL;

-- Preserve the canonical audit table created in 0000. Only add compatible fields.
ALTER TABLE "privacy_audit_logs" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "privacy_audit_logs"
  ADD COLUMN IF NOT EXISTS "subject_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Campaign configuration is structural and inactive by default. Production dates and activation
-- must be supplied through an audited deployment/admin process, not invented by a migration.
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "product_id" text;
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "campaign_type" text;
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "redemption_starts_at" timestamp;
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "requires_explicit_eligibility" boolean DEFAULT true NOT NULL;
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "requires_extension_invite" boolean DEFAULT false NOT NULL;
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "requires_founding_feedback" boolean DEFAULT false NOT NULL;
ALTER TABLE "founding_campaign_configs" ADD COLUMN IF NOT EXISTS "requires_creator_approval" boolean DEFAULT false NOT NULL;

INSERT INTO "founding_campaign_configs" (
  "campaign_id", "product_id", "campaign_type", "signup_starts_at", "signup_ends_at",
  "redemption_starts_at", "redemption_ends_at", "requires_explicit_eligibility",
  "requires_extension_invite", "requires_founding_feedback", "requires_creator_approval", "is_active"
) VALUES
  ('founding_launch_2026', 'com.notebox.pro.founding.launch3m', 'founding_launch',
   '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00',
   true, false, false, false, false),
  ('founding_extension_2026', 'com.notebox.pro.founding.extension9m', 'founding_extension',
   '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00',
   true, true, true, false, false),
  ('creator_bonus_2026', 'com.notebox.pro.creator.bonus1m', 'creator_bonus',
   '1970-01-01 00:00:00', '9999-12-31 23:59:59', '1970-01-01 00:00:00', '9999-12-31 23:59:59',
   false, false, false, true, false)
ON CONFLICT ("campaign_id") DO NOTHING;

UPDATE "founding_campaign_configs"
SET "product_id" = 'com.notebox.pro.founding.launch3m', "campaign_type" = 'founding_launch'
WHERE "campaign_id" = 'founding_2026' AND "product_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "founding_campaign_configs" WHERE "product_id" IS NULL OR "campaign_type" IS NULL) THEN
    RAISE EXCEPTION 'Campaign configuration contains unmapped rows; configure product_id and campaign_type before applying 0010';
  END IF;
END $$;

ALTER TABLE "founding_campaign_configs" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "founding_campaign_configs" ALTER COLUMN "campaign_type" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'founding_campaign_configs_product_id_unique'
  ) THEN
    ALTER TABLE "founding_campaign_configs"
      ADD CONSTRAINT "founding_campaign_configs_product_id_unique" UNIQUE ("product_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'founding_campaign_configs_campaign_type_check'
  ) THEN
    ALTER TABLE "founding_campaign_configs"
      ADD CONSTRAINT "founding_campaign_configs_campaign_type_check"
      CHECK ("campaign_type" IN ('founding_launch', 'founding_extension', 'creator_bonus'));
  END IF;
END $$;

-- Quota and response versioning support.
ALTER TABLE "regen_usage" ADD COLUMN IF NOT EXISTS "pending_count" integer DEFAULT 0 NOT NULL;

WITH aggregated AS (
  SELECT MIN("id"::text)::uuid AS keep_id, "user_id", "note_id", "perspective_type", SUM("count") AS total_count
  FROM "regen_usage"
  GROUP BY "user_id", "note_id", "perspective_type"
), updated AS (
  UPDATE "regen_usage" r
  SET "count" = a.total_count
  FROM aggregated a
  WHERE r."id" = a.keep_id
  RETURNING r."id"
)
DELETE FROM "regen_usage" r
USING aggregated a
WHERE r."user_id" = a."user_id"
  AND r."note_id" = a."note_id"
  AND r."perspective_type" = a."perspective_type"
  AND r."id" <> a.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS "regen_usage_user_note_type_unique"
  ON "regen_usage" ("user_id", "note_id", "perspective_type");

ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "version_num" integer DEFAULT 1 NOT NULL;
ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "is_current" boolean DEFAULT true NOT NULL;

WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "user_id", "note_id", "perspective_type" ORDER BY "created_at", "id") AS version_num,
         ROW_NUMBER() OVER (PARTITION BY "user_id", "note_id", "perspective_type" ORDER BY "created_at" DESC, "id" DESC) AS current_rank
  FROM "ai_responses"
)
UPDATE "ai_responses" a
SET "version_num" = r.version_num,
    "is_current" = (r.current_rank = 1)
FROM ranked r
WHERE a."id" = r."id";

CREATE UNIQUE INDEX IF NOT EXISTS "ai_responses_current_perspective_unique"
  ON "ai_responses" ("user_id", "note_id", "perspective_type") WHERE "is_current" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "ai_responses_note_type_version_unique"
  ON "ai_responses" ("user_id", "note_id", "perspective_type", "version_num");

ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "is_sample" boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_storage_key_unique" ON "receipts" ("storage_key");

CREATE UNIQUE INDEX IF NOT EXISTS "promotional_one_launch_per_campaign"
  ON "promotional_grants" ("user_id", "campaign_id", "grant_type")
  WHERE "grant_type" = 'founding_launch' AND "status" <> 'revoked';
CREATE UNIQUE INDEX IF NOT EXISTS "promotional_one_extension_per_campaign"
  ON "promotional_grants" ("user_id", "campaign_id", "grant_type")
  WHERE "grant_type" = 'founding_extension' AND "status" <> 'revoked';
CREATE UNIQUE INDEX IF NOT EXISTS "promotional_grant_approval_id_unique"
  ON "promotional_grants" ("approval_id") WHERE "approval_id" IS NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;
