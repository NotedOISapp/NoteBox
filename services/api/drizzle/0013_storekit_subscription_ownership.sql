-- A StoreKit subscription lineage may belong to only one NoteBox account.
-- Fail migration rather than silently choosing an owner if legacy duplicates exist.
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_platform_original_txn_unique"
  ON "subscriptions" ("platform", "original_txn_id");
