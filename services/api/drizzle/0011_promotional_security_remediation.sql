-- Migration 0011: Forward-only remediation for databases that received an earlier 0010 draft.
-- All statements are idempotent so fresh databases can also apply this migration safely.

ALTER TABLE "privacy_audit_logs" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "privacy_audit_logs"
  ADD COLUMN IF NOT EXISTS "subject_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Restore canonical UUID/enum audit types if an earlier 0010 converted them to text.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'privacy_audit_logs'
      AND column_name = 'actor_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE "privacy_audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;
    ALTER TABLE "privacy_audit_logs" ALTER COLUMN "actor_id" TYPE uuid USING NULLIF("actor_id", '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'privacy_audit_logs'
      AND column_name = 'request_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE "privacy_audit_logs" ALTER COLUMN "request_id" TYPE uuid USING NULLIF("request_id", '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'privacy_audit_logs'
      AND column_name = 'target_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE "privacy_audit_logs" ALTER COLUMN "target_id" TYPE uuid USING NULLIF("target_id", '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'privacy_audit_logs'
      AND column_name = 'actor_type' AND data_type = 'text'
  ) THEN
    ALTER TABLE "privacy_audit_logs" ALTER COLUMN "actor_type" TYPE "actor_type" USING "actor_type"::"actor_type";
  END IF;
END $$;

ALTER TABLE "storekit_transactions" DROP CONSTRAINT IF EXISTS "storekit_transactions_user_id_users_id_fk";
ALTER TABLE "storekit_transactions" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "storekit_transactions"
  ADD CONSTRAINT "storekit_transactions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

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
   '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00', true, false, false, false, false),
  ('founding_extension_2026', 'com.notebox.pro.founding.extension9m', 'founding_extension',
   '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00', true, true, true, false, false),
  ('creator_bonus_2026', 'com.notebox.pro.creator.bonus1m', 'creator_bonus',
   '1970-01-01 00:00:00', '9999-12-31 23:59:59', '1970-01-01 00:00:00', '9999-12-31 23:59:59', false, false, false, true, false)
ON CONFLICT ("campaign_id") DO NOTHING;

UPDATE "founding_campaign_configs"
SET "product_id" = 'com.notebox.pro.founding.launch3m', "campaign_type" = 'founding_launch'
WHERE "campaign_id" = 'founding_2026' AND "product_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "founding_campaign_configs" WHERE "product_id" IS NULL OR "campaign_type" IS NULL) THEN
    RAISE EXCEPTION 'Campaign configuration contains unmapped rows; configure product_id and campaign_type before applying 0011';
  END IF;
END $$;

ALTER TABLE "founding_campaign_configs" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "founding_campaign_configs" ALTER COLUMN "campaign_type" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'founding_campaign_configs_product_id_unique'
  ) THEN
    ALTER TABLE "founding_campaign_configs" ADD CONSTRAINT "founding_campaign_configs_product_id_unique" UNIQUE ("product_id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'founding_campaign_configs_campaign_type_check'
  ) THEN
    ALTER TABLE "founding_campaign_configs" ADD CONSTRAINT "founding_campaign_configs_campaign_type_check"
    CHECK ("campaign_type" IN ('founding_launch', 'founding_extension', 'creator_bonus'));
  END IF;
END $$;

ALTER TABLE "promotional_grants"
  ADD COLUMN IF NOT EXISTS "approval_id" uuid REFERENCES "creator_reward_approvals"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "promotional_one_launch_per_campaign"
  ON "promotional_grants" ("user_id", "campaign_id", "grant_type")
  WHERE "grant_type" = 'founding_launch' AND "status" <> 'revoked';
CREATE UNIQUE INDEX IF NOT EXISTS "promotional_one_extension_per_campaign"
  ON "promotional_grants" ("user_id", "campaign_id", "grant_type")
  WHERE "grant_type" = 'founding_extension' AND "status" <> 'revoked';
CREATE UNIQUE INDEX IF NOT EXISTS "promotional_grant_approval_id_unique"
  ON "promotional_grants" ("approval_id") WHERE "approval_id" IS NOT NULL;

ALTER TABLE "regen_usage" ADD COLUMN IF NOT EXISTS "pending_count" integer DEFAULT 0 NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "regen_usage_user_note_type_unique"
  ON "regen_usage" ("user_id", "note_id", "perspective_type");
ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "version_num" integer DEFAULT 1 NOT NULL;
ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "is_current" boolean DEFAULT true NOT NULL;
ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "is_sample" boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_storage_key_unique" ON "receipts" ("storage_key");

ALTER TABLE "upload_reservations" ADD COLUMN IF NOT EXISTS "expected_sha256" text;
ALTER TABLE "upload_reservations" ADD COLUMN IF NOT EXISTS "provider_object_version" text;
ALTER TABLE "upload_reservations" ADD COLUMN IF NOT EXISTS "confirmed_receipt_id" uuid REFERENCES "receipts"("id") ON DELETE SET NULL;
