-- 0008: Privacy Compliance Schema
-- Creates sessions, refresh tokens, reauthentication challenges,
-- account deletion jobs, data processing logs, and retention audits.
-- Adds 'failed' to export_status enum and compliance columns to data_exports.
-- Adds updated_at to sessions.

-- Add 'failed' to export_status enum
ALTER TYPE "export_status" ADD VALUE IF NOT EXISTS 'failed';
--> statement-breakpoint

-- Add missing display_photo_key column to boxes table
ALTER TABLE "boxes" ADD COLUMN "display_photo_key" text;
--> statement-breakpoint

-- Add missing avatar_key to people table
ALTER TABLE "people" ADD COLUMN "avatar_key" text;
--> statement-breakpoint

-- Add Apple OAuth tokens to users table
ALTER TABLE "users" ADD COLUMN "apple_refresh_token" text;
ALTER TABLE "users" ADD COLUMN "apple_access_token" text;
--> statement-breakpoint

-- Add compliance columns to data_exports
ALTER TABLE "data_exports" ADD COLUMN "claimed_by" text;
ALTER TABLE "data_exports" ADD COLUMN "claimed_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "lease_expires_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "claim_token" uuid;
ALTER TABLE "data_exports" ADD COLUMN "failure_code" text;
ALTER TABLE "data_exports" ADD COLUMN "artifact_storage_key" text;
ALTER TABLE "data_exports" ADD COLUMN "artifact_size_bytes" bigint;
ALTER TABLE "data_exports" ADD COLUMN "artifact_sha256" text;
ALTER TABLE "data_exports" ADD COLUMN "export_schema_version" text;
ALTER TABLE "data_exports" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "data_exports" ADD COLUMN "last_downloaded_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "download_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "data_exports" ADD COLUMN "snapshot_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "started_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "failed_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "expired_at" timestamp;
ALTER TABLE "data_exports" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "data_exports" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint

-- Create sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "authenticated_at" timestamp DEFAULT now() NOT NULL,
  "reauthenticated_at" timestamp,
  "revoked_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "token_family_id" uuid NOT NULL,
  "parent_token_id" uuid REFERENCES "refresh_tokens"("id"),
  "replaced_by_token_id" uuid REFERENCES "refresh_tokens"("id"),
  "token_hash" text UNIQUE NOT NULL,
  "idempotency_key_hash" text,
  "retry_response_ciphertext" text,
  "retry_response_expires_at" timestamp,
  "retry_response_key_version" text,
  "issued_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "revoked_at" timestamp,
  "reuse_detected_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create unique partial index on parent_token_id (one child per parent)
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_parent_idx"
  ON "refresh_tokens" ("parent_token_id")
  WHERE parent_token_id IS NOT NULL;
--> statement-breakpoint

-- Create reauthentication_challenges table
CREATE TABLE IF NOT EXISTS "reauthentication_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purpose" text NOT NULL,
  "challenge_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create account_deletion_jobs table
CREATE TABLE IF NOT EXISTS "account_deletion_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
  "status_token_hash" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "rate_limit_hits" integer DEFAULT 0 NOT NULL,
  "token_expires_at" timestamp NOT NULL,
  "token_revoked_at" timestamp,
  "token_failed_attempts" integer DEFAULT 0 NOT NULL,
  "apple_revocation_status" text DEFAULT 'not_applicable' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create data_processing_logs table
CREATE TABLE IF NOT EXISTS "data_processing_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "activity" text NOT NULL,
  "legal_basis" text NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create retention_deletion_audits table
CREATE TABLE IF NOT EXISTS "retention_deletion_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "deletion_mode" text NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL
);
