-- Enable Row-Level Security on all user-owned tables
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_policy ON "user_profiles" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "areas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY areas_policy ON "areas" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "boxes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY boxes_policy ON "boxes" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
CREATE POLICY people_policy ON "people" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_policy ON "notes" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipts_policy ON "receipts" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "ai_responses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_responses_policy ON "ai_responses" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "regen_usage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY regen_usage_policy ON "regen_usage" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_policy ON "subscriptions" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY entitlements_policy ON "entitlements" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "age_verification_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY age_verification_events_policy ON "age_verification_events" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "consent_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_events_policy ON "consent_events" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "privacy_preferences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY privacy_preferences_policy ON "privacy_preferences" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "deletion_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deletion_requests_policy ON "deletion_requests" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "dsar_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY dsar_requests_policy ON "dsar_requests" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "data_exports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_exports_policy ON "data_exports" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "ai_processing_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_processing_jobs_policy ON "ai_processing_jobs" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "ai_training_exclusions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_training_exclusions_policy ON "ai_training_exclusions" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "dismissed_patterns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY dismissed_patterns_policy ON "dismissed_patterns" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Join & relation-based tables RLS policies
ALTER TABLE "box_people" ENABLE ROW LEVEL SECURITY;
CREATE POLICY box_people_policy ON "box_people" FOR ALL USING (
  box_id IN (SELECT id FROM boxes WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

ALTER TABLE "note_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_versions_policy ON "note_versions" FOR ALL USING (
  note_id IN (SELECT id FROM notes WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

ALTER TABLE "add_mores" ENABLE ROW LEVEL SECURITY;
CREATE POLICY add_mores_policy ON "add_mores" FOR ALL USING (
  note_id IN (SELECT id FROM notes WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

ALTER TABLE "note_people" ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_people_policy ON "note_people" FOR ALL USING (
  note_id IN (SELECT id FROM notes WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

ALTER TABLE "ocr_texts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ocr_texts_policy ON "ocr_texts" FOR ALL USING (
  receipt_id IN (SELECT id FROM receipts WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

-- Analytics events RLS policy
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_events_policy ON "analytics_events" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
