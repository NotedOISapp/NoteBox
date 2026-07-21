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
