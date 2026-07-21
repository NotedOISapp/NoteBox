CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "boxes" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL;

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_policy ON "categories" FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
