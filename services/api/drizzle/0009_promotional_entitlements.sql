ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "app_account_token" uuid DEFAULT gen_random_uuid() NOT NULL;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_app_account_token_unique" UNIQUE("app_account_token");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."storekit_verification_status" AS ENUM('verified', 'rejected', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."promotional_grant_type" AS ENUM('founding_launch', 'founding_extension', 'creator_bonus');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."promotional_grant_status" AS ENUM('active', 'scheduled', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."creator_reward_approval_status" AS ENUM('submitted', 'approved', 'rejected', 'code_issued', 'redeemed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "storekit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"original_transaction_id" text,
	"user_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"app_account_token" uuid,
	"purchase_date" timestamp NOT NULL,
	"original_purchase_date" timestamp,
	"environment" text NOT NULL,
	"signed_transaction_hash" text NOT NULL,
	"verification_status" "storekit_verification_status" NOT NULL,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storekit_transactions_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "storekit_transactions_signed_transaction_hash_unique" UNIQUE("signed_transaction_hash")
);

CREATE TABLE IF NOT EXISTS "promotional_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"grant_type" "promotional_grant_type" NOT NULL,
	"transaction_id" text NOT NULL,
	"duration_months" integer NOT NULL,
	"status" "promotional_grant_status" NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotional_grants_transaction_id_unique" UNIQUE("transaction_id")
);

CREATE TABLE IF NOT EXISTS "user_campaign_states" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"founding_campaign_eligible" boolean DEFAULT false NOT NULL,
	"founding_campaign_anchor_at" timestamp,
	"extension_invite_issued_at" timestamp,
	"extension_feedback_completed_at" timestamp,
	"creator_reward_months_approved" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "founding_campaign_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"signup_starts_at" timestamp NOT NULL,
	"signup_ends_at" timestamp NOT NULL,
	"redemption_ends_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "founding_campaign_configs_campaign_id_unique" UNIQUE("campaign_id")
);

CREATE TABLE IF NOT EXISTS "creator_reward_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text DEFAULT 'tiktok' NOT NULL,
	"deliverable_url" text NOT NULL,
	"status" "creator_reward_approval_status" DEFAULT 'submitted' NOT NULL,
	"approved_months" integer DEFAULT 1 NOT NULL,
	"approved_at" timestamp,
	"code_issued_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "founding_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"what_worked" text NOT NULL,
	"what_was_confusing" text NOT NULL,
	"bugs_encountered" text NOT NULL,
	"most_valuable_feature" text NOT NULL,
	"what_almost_made_you_stop" text NOT NULL,
	"may_contact_for_follow_up" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "review_outreach_states" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"review_email_sent_at" timestamp,
	"review_reminder_sent_at" timestamp,
	"marketing_unsubscribed_at" timestamp
);

DO $$ BEGIN
 ALTER TABLE "storekit_transactions" ADD CONSTRAINT "storekit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "promotional_grants" ADD CONSTRAINT "promotional_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_campaign_states" ADD CONSTRAINT "user_campaign_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "creator_reward_approvals" ADD CONSTRAINT "creator_reward_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "founding_feedback" ADD CONSTRAINT "founding_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "review_outreach_states" ADD CONSTRAINT "review_outreach_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "storekit_transactions_user_id_idx" ON "storekit_transactions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "storekit_transactions_product_id_idx" ON "storekit_transactions" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "storekit_transactions_orig_txn_id_idx" ON "storekit_transactions" USING btree ("original_transaction_id");
CREATE INDEX IF NOT EXISTS "promotional_grants_user_id_idx" ON "promotional_grants" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "promotional_grants_grant_type_idx" ON "promotional_grants" USING btree ("grant_type");
