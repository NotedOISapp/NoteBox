## Plain-language branch scope

Base branch and starting commit:

Dependencies (other pull requests, contracts, migrations, services, or `None`):

What this branch changes:

What this branch deliberately does **not** change:

Why this change is needed:

Where a reviewer should start (folder or file):

## Primary area

- [ ] Backend (`services/api/`)
- [ ] Mobile frontend (`apps/mobile/`)
- [ ] Future web frontend (`apps/web/`, only after approved and created)
- [ ] Repository, CI, documentation, or release tooling
- [ ] Cross-area change — explain below why it cannot be safely split

Cross-area explanation or follow-up pull requests:

## Change type

- [ ] Feature
- [ ] Bug fix
- [ ] Hotfix
- [ ] Refactor with no intended behavior change
- [ ] Docs only
- [ ] Release preparation
- [ ] Dependency update
- [ ] Configuration or CI change

## User-visible result

Describe the exact behavior a person can observe after this merges. Write `None` for a non-user-facing change.

Acceptance test in plain language:

## Contracts, data, and rollout

- API contract impact:
- Database or migration impact:
- Older mobile-version compatibility:
- Security, privacy, entitlement, or billing impact:
- Deployment order or feature-flag requirement:
- Rollback or disable plan:

Use `None` only after checking the item.

## Verification evidence

Production-code changes require RED → GREEN → REFACTOR → VERIFY. Documentation-only changes may mark behavior-test fields `Not applicable — docs only`.

Failing test or reproduction before the fix:

Why it failed:

Passing targeted test after the fix:

Full verification command and result:

Real-device or external-service verification, when required:

## Risk areas

- [ ] Authentication or adult eligibility
- [ ] Ownership or authorization
- [ ] Entitlements or usage limits
- [ ] StoreKit
- [ ] Privacy, local security, or panic hide
- [ ] Draft or offline persistence
- [ ] Search
- [ ] Receipts, uploads, OCR, or object storage
- [ ] AI or Perspectives
- [ ] Export or account deletion
- [ ] Database migration
- [ ] App Store or TestFlight build
- [ ] No sensitive risk area

## Final safety checklist

- [ ] The branch name identifies the change type and primary area
- [ ] Permanent instructions were updated in the relevant area README when needed
- [ ] Unrelated areas were left untouched or the cross-area reason is documented
- [ ] No tests were weakened, skipped, or hidden
- [ ] No `.only`, `.skip`, `--passWithNoTests`, or lowered coverage threshold was added
- [ ] No secrets, private Note text, Receipt contents, or production user data were committed
- [ ] Data/API compatibility and migration safety were checked
- [ ] The rollback or disable path is understood
- [ ] Repository integrity checks pass
- [ ] GitHub CI passes before merge
