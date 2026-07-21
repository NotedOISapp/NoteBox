# GitHub Handoff

This repository may be sent to GitHub only from the repository working tree, never by uploading a desktop archive or an audit ZIP.

## Before opening the pull request

1. Use Node 22.16.x and npm 10.9.x.
2. Run `npm ci` in `apps/mobile` and `services/api`.
3. Ensure Docker is running; backend integration tests start PostgreSQL and Redis Testcontainers and must fail if those services cannot start.
4. Run `npm run verify` at the repository root.
5. Run `git status --short`, `git diff --stat`, and `git diff --summary`.
6. Confirm `git ls-files -s` contains no mode `160000` entries and there are no nested `.git` directories.
7. Review every untracked file before staging. Do not use blanket staging until secrets, archives, generated outputs, and local operator tooling have been ruled out.

## Secrets and archives

- Never commit `.env` files, Apple signing keys, provisioning profiles, StoreKit keys, database exports, user exports, audit packages, or build archives.
- Commit `.env.example` files with placeholders only.
- Do not upload `NoteBox App Build - Copy.zip` or any audit ZIP to GitHub. Those archives can include dependency trees, Git metadata, or credentials that are not part of source control.
- If a real credential has ever been included in a shared archive, rotate it outside this repository before deployment. Repository scanning cannot prove that an externally shared credential remains private.

## Required GitHub checks

The CI, hotfix, and release workflows run repository integrity checks, API lint/typecheck/build, both API test suites, and mobile lint/typecheck/tests. A Docker or Testcontainers failure is a failed integration gate; it is never reported as a skipped or successful test run.

The `@NotedOISapp` CODEOWNERS handle must be confirmed as a real GitHub user or organization team before branch protection requires code-owner approval.
