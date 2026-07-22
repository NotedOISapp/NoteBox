CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "operation" text NOT NULL,
  "client_mutation_id" text NOT NULL,
  "status_code" integer NOT NULL,
  "response_body_ciphertext" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_user_operation_mutation_unique"
  ON "idempotency_records" ("user_id", "operation", "client_mutation_id");
CREATE INDEX IF NOT EXISTS "idempotency_records_expires_at_idx"
  ON "idempotency_records" ("expires_at");

ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_records_policy ON "idempotency_records" FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- A merge must retain the exact association IDs it moved. Without this
-- snapshot, reversal cannot distinguish the survivor's original data.
ALTER TABLE "person_merges" ADD COLUMN IF NOT EXISTS "snapshot_version" integer;
ALTER TABLE "person_merges" ADD COLUMN IF NOT EXISTS "moved_mention_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;
ALTER TABLE "person_merges" ADD COLUMN IF NOT EXISTS "moved_alias_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;
ALTER TABLE "person_merges" ADD COLUMN IF NOT EXISTS "moved_role_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;

-- v1 uses boolean self-attestation only. Remove the conflicting legacy
-- month/year-derived model and any obsolete values it collected.
DROP TABLE IF EXISTS "age_verification_events";
DROP TYPE IF EXISTS "age_verification_method";
DROP TYPE IF EXISTS "age_band";
