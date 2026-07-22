# NoteBox Repository Map

This is the plain-language guide for deciding where a change belongs. Start here when something needs to be fixed or updated.

## The Simple Picture

| Part | Location | What it means in everyday language | Start here |
| --- | --- | --- | --- |
| Backend | `services/api/` | The secure system behind the app: accounts, saved data, permissions, subscriptions, uploads, search, AI jobs, and exports | [`services/api/README.md`](../../services/api/README.md) |
| Mobile frontend | `apps/mobile/` | The iPhone app the user sees and touches, including screens, navigation, offline behavior, and device privacy | [`apps/mobile/README.md`](../../apps/mobile/README.md) |
| Future web frontend | `apps/web/` | Reserved location for a later browser app | Does not exist yet; create only after approval |
| Repository safety | `scripts/` and `.github/` | Automated checks, pull-request rules, and GitHub workflows | [`BRANCHING_STRATEGY.md`](BRANCHING_STRATEGY.md) |
| Product and release rules | `docs/` | What NoteBox is, how it must behave, and how it ships | [`NOTEBOX_V1_MASTER_HANDOFF.md`](../product/NOTEBOX_V1_MASTER_HANDOFF.md) |

The backend and frontend are separate code areas, but they live in one repository so one pull request can clearly show when a contract between them changes.

## If This Breaks, Look Here First

| Problem you notice | Primary area | Why |
| --- | --- | --- |
| A screen looks wrong, a button goes nowhere, or navigation is broken | `apps/mobile/src/app/` and `apps/mobile/src/components/` | These files control what the iPhone user sees and where taps lead |
| A draft disappears, an offline action is lost, or the app lock behaves incorrectly | `apps/mobile/src/services/` and `apps/mobile/src/context/` | These files manage local device behavior and app-wide state |
| Sign in fails before the request reaches the app | Start in `apps/mobile/src/services/`, then check `services/api/src/routes/auth.ts` | Sign in crosses the phone-to-server boundary |
| A user can see or change data they should not own | `services/api/src/middleware/` and the relevant route | Ownership and authorization must be enforced by the backend |
| A Box, Note, Person, Receipt, or other record saves incorrectly | `services/api/src/routes/`, `services/api/src/db/schema.ts`, and migrations | The backend owns the canonical saved record |
| Search misses content or exposes the wrong content | `services/api/src/routes/search.ts` first, then the mobile search UI | Search scope and permissions are backend responsibilities |
| A Receipt upload, OCR job, or downloaded file fails | `services/api/src/routes/receipts.ts` and Receipt services | The backend owns storage integrity and processing lifecycle |
| Perspectives are missing, unsafe, or use the wrong saved material | `services/api/src/routes/perspectives.ts` and AI utilities | The backend owns AI scope, generation, and enforcement |
| A paid feature is unlocked or blocked incorrectly | Backend entitlement and StoreKit services first, then the mobile presentation | The server is the source of truth; the app only presents the result |
| A database change or deployment fails | `services/api/drizzle/`, `services/api/src/db/`, and migration docs | Schema history and safe rollout live here |
| Automated checks or GitHub behavior are wrong | `.github/workflows/`, `scripts/`, and root `package.json` | These files define repository-wide verification |
| App Store or TestFlight preparation is wrong | `docs/release/` and mobile build configuration | Release requirements and iOS packaging meet here |

## Permanent Boundaries, Temporary Branches

Do not create permanent `backend`, `frontend`, or feature branches. They drift apart and make it unclear which version is real.

Use:

- `main` for production-ready code.
- A short-lived branch for one understandable change.
- A pull request whose scope card says what changed, what did not change, where to review, and how to verify it.

Examples:

- `bugfix/api-receipt-upload`
- `feature/api-export-status`
- `bugfix/mobile-draft-recovery`
- `feature/mobile-search-filters`
- `docs/repository-map`
- `chore/repo-node-upgrade`
- `hotfix/api-auth-revocation`
- `release/1.0.0`

The area word is the key:

- `api` means backend.
- `mobile` means the current iPhone frontend.
- `web` will mean the future browser frontend only after `apps/web/` exists.
- `repo` means shared automation, documentation, or release infrastructure.

## When a Change Crosses Areas

Prefer two focused pull requests when the backend and frontend can remain compatible during rollout:

1. Add the backward-compatible backend contract.
2. Update the frontend to use it.
3. Remove an old contract later only after nothing uses it.

Use one cross-area pull request only when splitting the work would create a broken or insecure intermediate state. The pull request must explain why the areas cannot be separated and must list verification for each area.

## Documentation Rule

Do not copy a README onto every Git branch. A copied file becomes stale and can contradict the real code.

Instead:

- Keep permanent instructions beside the code they describe.
- Update an area README when that area's ownership or workflow changes.
- Use the pull-request scope card as the temporary README for that branch.
- Record major, lasting architectural decisions in `docs/architecture/`.

## Before You Say a Change Is Done

1. Read the README for the primary area.
2. Confirm the branch name identifies the change type and area.
3. Keep unrelated areas untouched, or explain why the change must cross boundaries.
4. Add or update tests for changed behavior.
5. Run the checks listed in the area README.
6. Complete the pull-request scope card in plain language.
7. Confirm GitHub checks pass before merge.
