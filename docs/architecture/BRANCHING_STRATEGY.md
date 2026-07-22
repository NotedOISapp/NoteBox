# NoteBox Branching Strategy

Branches are temporary packages of work. Folders are the permanent backend, mobile, and future-web boundaries.

Do not keep permanent `backend`, `frontend`, `develop`, or feature branches. They drift apart and make it unclear which version is safe.

## The One Long-Lived Branch

### `main`

`main` is the production-ready source of truth and the base for new work.

- Always releasable
- Protected from direct and force pushes
- Receives reviewed pull requests only
- Release tags are cut only from `main`

Create another permanent branch only if a documented release-management need is approved later. Do not create one merely to represent a code area.

## Branch Names You Can Understand at a Glance

Use `<type>/<area>-<short-description>`.

### Change types

| Type | Use it for | Starts from | Merges into | Example |
| --- | --- | --- | --- | --- |
| `feature/` | New approved behavior | `main` | `main` | `feature/mobile-search-filters` |
| `bugfix/` | Normal defect fixes | `main` | `main` | `bugfix/api-receipt-upload` |
| `refactor/` | Behavior-preserving code organization | `main` | `main` | `refactor/api-receipts-module` |
| `docs/` | Documentation only | `main` | `main` | `docs/repo-maintenance-map` |
| `chore/` | Dependencies, CI, tooling, or repository maintenance | `main` | `main` | `chore/repo-node-upgrade` |
| `sync/` | Controlled source reconciliation | Explicit approved base | The approved target | `sync/repo-sanitized-source` |
| `release/` | TestFlight and App Store stabilization | Current verified `main` | `main` | `release/1.0.0` |
| `hotfix/` | A confirmed production emergency | `main` | `main` | `hotfix/api-auth-revocation` |

### Area names

| Area | Meaning | Normal location |
| --- | --- | --- |
| `api` | Backend and database | `services/api/` |
| `mobile` | Current iPhone frontend | `apps/mobile/` |
| `web` | Future browser frontend | `apps/web/` after it is approved and created |
| `repo` | Shared docs, scripts, GitHub workflows, or release infrastructure | Root, `docs/`, `scripts/`, `.github/` |

Do not use `web` as an area until the web application actually exists. Do not call the API the “frontend” simply because it serves the frontend.

## Normal Change Workflow

1. Update local `main` from GitHub and confirm it is clean.
2. Create one narrowly named feature, bug-fix, refactor, docs, or chore branch.
3. Read the README for the primary area.
4. Add the failing behavior test first when production behavior changes.
5. Make the smallest complete change.
6. Run the area's checks and repository checks.
7. Open a pull request to `main` and complete the plain-language scope card.
8. Merge only after review and CI pass.
9. Delete the short-lived remote branch after merge when repository policy allows it.

## Release Workflow

1. Confirm every intended change is already merged to `main` and CI is green.
2. Create `release/x.y.z` from that verified `main` commit.
3. Freeze new features.
4. Allow only release blockers, version changes, and build fixes.
5. Run the full release-candidate workflow.
6. Verify the candidate on a real iPhone through TestFlight or the approved internal path.
7. Merge any release fixes into `main` through the release pull request.
8. Tag the release from the resulting `main` commit.

## Hotfix Workflow

1. Confirm the live production issue.
2. Create `hotfix/<area>-<description>` from `main`.
3. Start with a failing regression test unless explicitly approved otherwise.
4. Apply only the production fix.
5. Run the hotfix workflow and device verification when relevant.
6. Merge into `main` through a pull request and tag the patch.

## Backend and Frontend Changes

Keep backend and frontend work in separate branches when they can be safely deployed in stages.

Preferred order:

1. Add a backward-compatible backend contract on an `api` branch.
2. Update the current app on a `mobile` branch.
3. Remove an old backend contract later, after no supported app uses it.

A single branch may touch more than one area only when separating it would create a broken or insecure intermediate state. Its pull request must explain why it cannot be split and list checks for every affected area.

## The Pull Request Is the Branch README

Do not add a copied README file just for a Git branch. It will become stale after the branch merges.

Every pull request must instead state, in layman's terms:

- Base branch and dependencies
- What this branch changes
- What it deliberately does not change
- Which area owns the change
- Where a reviewer should start
- Expected user-visible behavior
- Migration and API contract impact
- How the change was tested
- How to disable or reverse it if something goes wrong

The repository pull-request template provides this scope card automatically.

## Legacy or Unrelated Branches

A branch that does not descend from the current sanitized `main` is not an active development branch.

- Do not merge or cherry-pick it into `main` without a reviewed source-reconciliation process.
- Do not use it as the base for new work.
- Preserve required history in the approved private recovery artifact.
- Audit it for secrets, private data, gitlinks, and required missing behavior.
- Remove a public legacy ref only with explicit owner approval and verified recovery evidence.
