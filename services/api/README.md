# NoteBox Backend

This folder is the backend: the secure system that runs behind the iPhone app.

It decides who a user is, what that user is allowed to access, what is saved permanently, whether plan limits are enforced, how Receipts are stored and processed, what Search may return, and how server jobs such as Perspectives and exports run.

If a rule must still hold when someone modifies or bypasses the mobile app, that rule belongs here.

## What This Area Owns

- Authentication, sessions, and account deletion
- Adult eligibility and private-data access guards
- User ownership and authorization
- Boxes, Categories, People, Notes, Add more blocks, and versions
- Receipt upload integrity, storage, OCR, and processing jobs
- Search scope and results
- Perspectives and other AI calls
- StoreKit verification, subscriptions, entitlements, and usage limits
- Exports, compliance records, and privacy-safe analytics intake
- PostgreSQL schema, migrations, and server-side background work

It does not own iPhone screens, button placement, device navigation, local app-lock presentation, or other mobile-only interface behavior. Those belong in [`apps/mobile/`](../../apps/mobile/README.md).

## Folder Guide

| Location | What it does | Look here when |
| --- | --- | --- |
| `src/index.ts` | Starts the server and mounts routes and workers | An endpoint exists but is not reachable, or startup fails |
| `src/routes/` | Receives requests and returns responses | One API operation behaves incorrectly |
| `src/middleware/` | Applies security gates before route logic | Auth, ownership, eligibility, rate limiting, validation, or idempotency is wrong |
| `src/db/schema.ts` | Defines the current database model | A saved record has the wrong shape or relationship |
| `drizzle/` | Stores the ordered database change history | The schema must change or a deployment migration fails |
| `src/services/` | Runs multi-step business and provider workflows | StoreKit, Receipt processing, entitlements, or other long-running logic fails |
| `src/utils/` | Provides focused integrations and shared helpers | Apple, AI, logging, crypto, prompts, or common utilities fail |
| `src/config/` | Validates server configuration | Startup rejects or silently misses an environment setting |
| `src/privacy/` and `src/compliance/` | Defines privacy inventory and compliance storage behavior | Export, deletion, retention, or privacy review is involved |
| `tests/` and nearby `*.test.ts` files | Prove behavior against units and real infrastructure | A regression needs a reproducible test |

## Common Problems and Starting Points

- Sign in or session problem: `src/routes/auth.ts`, `src/middleware/auth.ts`, and Apple auth utilities.
- Wrong user's data appears: the relevant route plus ownership middleware or row-level security setup.
- Box, Note, Person, Category, or Add more problem: the matching route and `src/db/schema.ts`.
- Receipt upload or OCR problem: `src/routes/receipts.ts` and the Receipt services.
- Perspective generation problem: `src/routes/perspectives.ts`, prompt utilities, and provider configuration.
- Search problem: `src/routes/search.ts`; permissions and canonical saved records must be checked before presentation.
- Paid-access problem: entitlement services, `src/routes/entitlements.ts`, StoreKit routes/services, then the mobile display.
- Export or account-deletion problem: compliance routes/services and every storage location listed in the privacy inventory.
- Server fails at launch: `src/config/env.ts`, `src/index.ts`, database connection, and worker/provider configuration.

## Rules That Must Not Be Moved to the Mobile App

- Ownership and authorization
- Subscription entitlements and real usage limits
- Receipt storage integrity and processing state
- Search permission scope
- AI input scope and consent enforcement
- Export completeness
- Account deletion and retention behavior

Mobile checks may make the experience clearer, but they are never the security boundary.

## Safe Change Process

1. Use a focused branch such as `bugfix/api-receipt-upload` or `feature/api-export-status`.
2. Reproduce the problem with a failing test before changing production behavior.
3. Fix the smallest responsible route, service, middleware, schema, or configuration area.
4. If the database changes, add a new migration. Never rewrite a migration that may already have run.
5. Confirm old mobile versions remain safe, or document the coordinated rollout.
6. Run backend checks and the repository safety checks.
7. Explain data, migration, security, and rollback impact in the pull request.

## Commands

From the repository root:

```bash
npm run api:lint
npm run api:typecheck
npm run api:build
npm run api:test:unit
npm run api:test:integration
npm run check:repository
```

The integration tests require Docker because they verify behavior with real PostgreSQL and Redis services.

To run the complete repository gate, including mobile checks:

```bash
npm run verify
```

## Database Changes

Read [`MIGRATION_SAFETY.md`](../../docs/architecture/MIGRATION_SAFETY.md) before changing the schema.

- Add migrations in order under `drizzle/`.
- Keep the schema and migration history aligned.
- Preserve existing user data.
- Plan forward and rollback behavior before deployment.
- Never use a convenient local database reset as proof that a production migration is safe.

## Secrets and Private Data

Use `services/api/.env.example` to document variable names only. Never commit real keys, tokens, credentials, private user text, uploaded files, or production database content.

Logs and analytics must not contain private Note text or Receipt contents.
