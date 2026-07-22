ALTER TABLE "receipts"
  ADD COLUMN IF NOT EXISTS "provider_object_version" text;

-- Preserve exact versions already captured by upload confirmation or the
-- durable scan producer. Legacy rows without a captured provider version stay
-- nullable and are handled fail-closed by Receipt workers and export reads.
UPDATE "receipts" receipt
SET "provider_object_version" = job."expected_object_version"
FROM "receipt_processing_jobs" job
WHERE job."receipt_id" = receipt."id"
  AND job."job_type" = 'scan'
  AND job."expected_object_version" IS NOT NULL
  AND receipt."provider_object_version" IS NULL;

UPDATE "receipts" receipt
SET "provider_object_version" = (
  SELECT reservation."provider_object_version"
  FROM "upload_reservations" reservation
  WHERE reservation."confirmed_receipt_id" = receipt."id"
    AND reservation."provider_object_version" IS NOT NULL
  ORDER BY reservation."created_at" DESC, reservation."id" DESC
  LIMIT 1
)
WHERE receipt."provider_object_version" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "upload_reservations" reservation
    WHERE reservation."confirmed_receipt_id" = receipt."id"
      AND reservation."provider_object_version" IS NOT NULL
  );
