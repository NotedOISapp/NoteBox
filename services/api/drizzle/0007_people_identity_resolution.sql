-- Create new types/enums
CREATE TYPE "person_status" AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE "alias_type" AS ENUM ('name', 'nickname', 'relationship', 'abbreviation', 'dictation_variant', 'misspelling', 'role_phrase', 'custom');
CREATE TYPE "match_mode" AS ENUM ('exact', 'phrase', 'phonetic', 'fuzzy');
CREATE TYPE "scope_type" AS ENUM ('mention', 'box', 'category', 'time_range', 'global');
CREATE TYPE "confirmation_status" AS ENUM ('user_confirmed', 'system_suggested', 'rejected');
CREATE TYPE "mention_source_type" AS ENUM ('note', 'add_more', 'ocr', 'dictation');
CREATE TYPE "mention_origin" AS ENUM ('explicit_at_tag', 'manual_person_tag', 'plain_text_detection', 'ocr_detection', 'dictation_detection', 'user_created');
CREATE TYPE "mention_status" AS ENUM ('unresolved', 'likely', 'confirmed', 'ignored', 'rejected', 'stale');
CREATE TYPE "confidence_band" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "resolution_source" AS ENUM ('explicit_tag', 'manual_confirmation', 'clarification_answer', 'approved_rule', 'historical_review');
CREATE TYPE "candidate_state" AS ENUM ('active', 'accepted', 'rejected', 'expired');
CREATE TYPE "resolution_action" AS ENUM ('confirm_existing_person', 'create_and_confirm_person', 'reassign_person', 'remove_person_link', 'mark_not_person', 'leave_unresolved', 'defer', 'restore', 'conflict_detected');
CREATE TYPE "resolution_event_source" AS ENUM ('inline_tag', 'save_clarification', 'review_queue', 'person_detail', 'note_detail', 'historical_review', 'sync_resolution');
CREATE TYPE "question_type" AS ENUM ('same_name_identity', 'alias_match', 'new_person', 'role_reference', 'pronoun_reference', 'spelling_or_dictation', 'rule_scope', 'rule_conflict');
CREATE TYPE "question_status" AS ENUM ('pending', 'answered', 'deferred', 'dismissed', 'expired', 'invalidated');
CREATE TYPE "option_type" AS ENUM ('existing_person', 'create_new_person', 'not_a_person', 'leave_unresolved', 'approve_alias', 'reject_alias', 'scope_mention', 'scope_box', 'scope_category', 'scope_global');
CREATE TYPE "merge_status" AS ENUM ('pending', 'completed', 'reversed');

-- Alter people table (renaming column and adding new columns)
ALTER TABLE "people" RENAME COLUMN "name" TO "display_name";
ALTER TABLE "people" ADD COLUMN "full_name" text;
ALTER TABLE "people" ADD COLUMN "context_label" text;
ALTER TABLE "people" ADD COLUMN "avatar_receipt_id" uuid;
ALTER TABLE "people" ADD COLUMN "status" "person_status" DEFAULT 'active' NOT NULL;
ALTER TABLE "people" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "people" ADD COLUMN "deleted_at" timestamp;

-- Create person_roles
CREATE TABLE IF NOT EXISTS "person_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "box_id" uuid REFERENCES "boxes"("id") ON DELETE SET NULL,
  "valid_from" timestamp,
  "valid_to" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create person_aliases
CREATE TABLE IF NOT EXISTS "person_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "raw_value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "alias_type" "alias_type" NOT NULL,
  "match_mode" "match_mode" NOT NULL,
  "scope_type" "scope_type" NOT NULL,
  "scope_id" uuid,
  "valid_from" timestamp,
  "valid_to" timestamp,
  "confirmation_status" "confirmation_status" NOT NULL,
  "auto_confirm_allowed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create person_mentions
CREATE TABLE IF NOT EXISTS "person_mentions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_type" "mention_source_type" NOT NULL,
  "source_id" uuid NOT NULL,
  "source_version_id" uuid NOT NULL,
  "raw_text" text NOT NULL,
  "normalized_text" text NOT NULL,
  "start_offset" integer,
  "end_offset" integer,
  "context_before" text,
  "context_after" text,
  "origin" "mention_origin" NOT NULL,
  "status" "mention_status" NOT NULL,
  "linked_person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
  "candidate_confidence" double precision,
  "confidence_band" "confidence_band",
  "resolution_source" "resolution_source",
  "resolution_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create mention_candidates
CREATE TABLE IF NOT EXISTS "mention_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mention_id" uuid NOT NULL REFERENCES "person_mentions"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "score" double precision NOT NULL,
  "rank" integer NOT NULL,
  "supporting_reasons" text[] NOT NULL,
  "contradictory_reasons" text[] NOT NULL,
  "state" "candidate_state" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp
);

-- Create mention_resolution_events
CREATE TABLE IF NOT EXISTS "mention_resolution_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mention_id" uuid NOT NULL REFERENCES "person_mentions"("id") ON DELETE CASCADE,
  "action" "resolution_action" NOT NULL,
  "previous_person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
  "next_person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
  "source" "resolution_event_source" NOT NULL,
  "client_mutation_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create clarification_questions
CREATE TABLE IF NOT EXISTS "clarification_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "source_version_id" uuid NOT NULL,
  "question_type" "question_type" NOT NULL,
  "status" "question_status" NOT NULL,
  "prompt_template_key" text NOT NULL,
  "mention_ids" uuid[] NOT NULL,
  "ambiguity_score" double precision NOT NULL,
  "impact_score" double precision NOT NULL,
  "answerability_score" double precision NOT NULL,
  "novelty_factor" double precision NOT NULL,
  "user_tolerance_factor" double precision NOT NULL,
  "priority_score" double precision NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "answered_at" timestamp
);

-- Create clarification_options
CREATE TABLE IF NOT EXISTS "clarification_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question_id" uuid NOT NULL REFERENCES "clarification_questions"("id") ON DELETE CASCADE,
  "option_type" "option_type" NOT NULL,
  "person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
  "display_label" text NOT NULL,
  "supporting_label" text,
  "sort_order" integer NOT NULL
);

-- Create person_merges
CREATE TABLE IF NOT EXISTS "person_merges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "surviving_person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "merged_person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "status" "merge_status" NOT NULL,
  "reversible_until" timestamp NOT NULL,
  "initiated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "reversed_at" timestamp
);

-- Enable RLS and Create Policies
ALTER TABLE "person_roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_roles_policy ON "person_roles" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "person_aliases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_aliases_policy ON "person_aliases" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "person_mentions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_mentions_policy ON "person_mentions" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "mention_candidates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY mention_candidates_policy ON "mention_candidates" FOR ALL USING (
  mention_id IN (SELECT id FROM person_mentions WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

ALTER TABLE "mention_resolution_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY mention_resolution_events_policy ON "mention_resolution_events" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "clarification_questions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY clarification_questions_policy ON "clarification_questions" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "clarification_options" ENABLE ROW LEVEL SECURITY;
CREATE POLICY clarification_options_policy ON "clarification_options" FOR ALL USING (
  question_id IN (SELECT id FROM clarification_questions WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

ALTER TABLE "person_merges" ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_merges_policy ON "person_merges" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
