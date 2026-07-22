ALTER TABLE "users" ADD COLUMN "age_attested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_attested_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_attestation_version" text;