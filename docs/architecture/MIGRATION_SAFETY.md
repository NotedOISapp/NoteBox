# Migration Safety

Database migrations must be safe for live mobile apps.

Rules:

- No destructive migration without backup
- No destructive migration without rollback plan
- Use expand and contract pattern for breaking changes
- Test migrations on staging before production
- Support overlapping mobile app versions
- Never deploy a backend that requires a mobile update already installed
- Account deletion must remain reliable after migrations
- Search indexes must remain consistent after migrations
- Entitlements must remain reliable after migrations

## Journal and snapshot policy

- Every `drizzle/NNNN_name.sql` file must have exactly one ordered entry in `drizzle/meta/_journal.json`.
- Snapshot-backed migrations and approved hand-authored migrations are mutually exclusive classifications.
- `drizzle/meta/migration-policy.json` is the explicit allowlist for hand-authored migrations that do not have Drizzle snapshots.
- `npm run check:migrations` must pass before generating, reviewing, or applying a migration.
- Do not delete or renumber an applied migration. Add a new forward migration.
- Because migrations after `0004_violet_black_panther` are hand-authored, review `drizzle-kit generate` output for duplicate operations against `0005` and later. Never apply generated output without that review.
- A new hand-authored migration must be added to the journal and the manual-migration allowlist in the same change. A Drizzle-generated migration must include its snapshot and must not be added to the manual allowlist.
