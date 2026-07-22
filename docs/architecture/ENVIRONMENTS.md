# Environments

## development

Local developer environment.

May use local services and test data.

Never uses production secrets.

## staging

Production-like test environment.

Uses staging database, staging object storage, staging AI keys, StoreKit sandbox, and test credentials.

Used before release.

## production

Live user environment.

Uses production database, production object storage, production AI keys, production StoreKit config, and production secrets.

Receipt processing additionally requires separate HTTPS security-scan and OCR provider endpoints plus independent bearer tokens. The API refuses to start in production when either provider is missing, non-HTTPS, credential-bearing in the URL, or paired with a token shorter than 32 characters. Provider timeouts and maximum object size are bounded by `RECEIPT_PROCESSING_TIMEOUT_MS` and `RECEIPT_PROCESSING_MAX_BYTES`.

The Receipt worker uses the normal server database pool on a dedicated session and sets `app.receipt_worker=true` only for the duration of a worker run. Migration `0014_receipt_processing_lifecycle` grants RLS policies for that context on Receipt jobs, Receipts, OCR text, and privacy preferences. A separately provisioned non-owner worker database role therefore needs ordinary `SELECT`, `INSERT`, and `UPDATE` grants on those tables and sequence usage where applicable; it must not receive a general RLS-bypass role attribute.

## Rules

Development data never mixes with production data.

Staging data never mixes with production data.

Production secrets never go into `.env`.

Expo public variables may contain only public client values.

Backend secrets belong in secret management.

StoreKit sandbox and production must remain separate.

AI provider keys must be environment-specific.

Object storage must be environment-specific.

Database URLs must be environment-specific.

Receipt provider tokens and endpoints must be environment-specific and must never be exposed through Expo public variables.
