# NoteBox Repository Agent Doctrine

These instructions apply to every file, folder, branch, worktree, app, service, package, script, and document in this repository.

They apply to every agent and contributor.

## Canonical source of truth

The canonical product and engineering source of truth is:

docs/product/NOTEBOX_V1_MASTER_HANDOFF.md

Every agent must read the relevant portions of that file before changing code.

If a task conflicts with the master handoff, stop and report the conflict.

Do not silently override the master handoff.

## Production safety rule

NoteBox is an App Store-bound private app handling sensitive personal content.

Repository safety comes before speed.

No change is complete until it is tested, reviewed, committed, pushed, and verified through the correct workflow.

## Branch rules

Never push directly to main.

Never force push.

Never use a feature branch as a release branch.

Never claim app-wide governance exists until the governance change is merged into the default branch.

Feature work must use feature branches.

Bug fixes must use bugfix branches.

Production emergencies must use hotfix branches.

Releases must use release branches.

## TDD rule

All production-code changes must follow Evidence-Based Test-Driven Development.

The required cycle is:

RED -> GREEN -> REFACTOR -> VERIFY

Tests written after implementation do not satisfy TDD.

Every bug fix must begin with a failing regression test.

Every new behavior must begin with a failing behavioral test.

A targeted test run is not release verification.

A feature branch passing tests is not the same as the integrated app being safe.

## Prohibited shortcuts

Agents must not:

- Skip the RED phase
- Fabricate test evidence
- Weaken assertions
- Delete failing tests to restore green status
- Add `.only`
- Add `.skip`
- Use `--passWithNoTests`
- Reduce coverage thresholds
- Add coverage exclusions to hide untested code
- Mock the business logic under test
- Replace integration tests with shallow mocks
- Bypass hooks with `--no-verify`
- Push known failures
- Push directly to main
- Treat branch-local checks as App Store release validation

## Release rule

No TestFlight or App Store submission may happen unless the release candidate passes the full release gate from a release branch.

A passing feature branch is not a passing application.

A passing targeted test is not a passing application.

A release requires integrated verification.

## Sensitive areas

Extra caution is required for:

- Authentication
- Sign in with Apple
- Adult eligibility
- Entitlements
- StoreKit
- Draft persistence
- Panic hide
- Local storage
- Receipts
- OCR consent
- Receipt Use in response consent
- Search authorization
- AI scope
- Account deletion
- Privacy lock
- Analytics privacy
- App Store build configuration

Any change touching these areas requires tests and explicit risk reporting.
