# Sanitized Publication Manifest

This manifest records the reviewed content imported into the clean publication repository. The legacy Git object database is preserved only in a private offline bundle and must never be connected as a push source.

## Publication base

- Public base: GitHub `main` at `f8bd6a99f4a5a4fd328f6d0ff80346f097295a64`.
- Reviewed source snapshot: legacy tree `f26e7bb2212244579d983a90014fb30d3c9791c6`.
- Legacy source tree: `ab1d4144d3059a2806c106934ef33402c73e4636`.
- Import mechanism: `git archive` followed by a selective ordinary-file copy. No legacy commit, ref, or Git metadata was imported.

## Included content

| Path | Owner | Source | Type | Reason | Reconciliation |
| --- | --- | --- | --- | --- | --- |
| `.easignore`, `.gitignore` | Repository | `f26e7bb` | Configuration | Packaging and repository hygiene | Included |
| `.env.example` | API | Public `main`/`f26e7bb` identical | Configuration | Placeholder-only environment contract | Included; disclosure scan required |
| `.github/` | Repository | `f26e7bb` | Workflow/governance | CI and ownership rules | Included; `@NotedOISapp` identity confirmed July 21, 2026 |
| `AGENTS.md` | Repository | `f26e7bb` | Governance | Canonical engineering constraints | Included |
| `README.md` | Repository | `f26e7bb` | Documentation | Canonical workspace entry point | Included with corrected repository-relative release link |
| `NoteBox v1 Master Handoff.md` | Product | `f26e7bb` | Documentation pointer | Points to the editable canonical specification | Included |
| `docs/product/` | Product | `f26e7bb` | Documentation | Canonical editable product specification | Included |
| `docs/architecture/` | Repository/API/Mobile | `f26e7bb` | Documentation | Current branching, environment, migration, and testing rules | Included except stale audits listed below |
| `docs/compliance/INCIDENT_RESPONSE.md` | Compliance | `f26e7bb` | Documentation | Operational incident process | Included |
| `docs/design/` | Mobile | `f26e7bb` | Documentation | Current design specification | Included |
| `docs/qa/QA_SHIP_BLOCKERS.md` | QA | Public `main`/`f26e7bb` identical | Documentation | User-observable release blockers | Relocated without content loss |
| `docs/release/` | Release | `f26e7bb` | Documentation | App-store, release, and GitHub gates | Included with this manifest |
| `apps/mobile/` | Mobile | `f26e7bb` plus recovery fixes | Source, assets, tests, lockfile | Canonical mobile application | Included; simulated and client-only flows listed below were replaced or made fail-closed |
| `services/api/` | API | `f26e7bb` | Source, migrations, tests, lockfile | Canonical backend application | Included |
| `scripts/` | Repository | `f26e7bb` | Verification tooling | Repository, lockfile, migration, and test-classification gates | Included |
| `package.json`, `package-lock.json` | Repository | `f26e7bb` | Orchestration and lockfile | Canonical root commands using independent npm projects | Included |

## Excluded content

| Path or content | Classification | Reason |
| --- | --- | --- |
| Legacy `.git/` and every legacy ref | Unsafe history | Contains accidental mode `160000`, operator files, and imported repository ancestry |
| `NoteBox` | Accidental gitlink | Mobile source is flattened and reviewed under `apps/mobile` |
| `.agents/`, `..agents/`, Athena and Superpowers | Local/external tooling | Not first-party shipping source |
| `antigravity-awesome-skills`, `nango`, `ruflo` and archived copies | External repositories | Must be installed separately if ever required; not application source |
| Legacy `server/` | Superseded duplicate | Reconciled into `services/api` |
| Legacy `clickhouse/`, `postgres/`, `protocols/` | External or duplicate infrastructure | Not required by the canonical application tree |
| `Backend Rules/`, `Inspo Designs/`, root background images | Audit/design input | Not referenced shipping source; preserved only in private legacy recovery |
| `PUSH_TO_GITHUB.ps1`, `CREATE_AUDIT_ZIP.ps1` | Obsolete/local operator tooling | Conflicts with governed pull-request publication |
| `AUTONOMOUS_FEATURE_SPEC.md`, `compliance-architecture.md` | Superseded specifications | Conflict with the approved v1 product and privacy model |
| `BACKEND_FIX_REPORT.md` | Historical verification report | Contains workspace-specific provenance and is not current publication evidence |
| `docs/architecture/SWARM_ALIGNMENT_AUDIT.md` | Stale audit | References obsolete local branches, paths, and unsupported completion claims |
| `docs/architecture/PRODUCTION_SEGMENTATION_AUDIT.md` | Historical audit | References absent archives and past phased status |
| `docs/qa/SWARM_CODE_AUDIT.md` | Unsafe/stale audit | Contains absolute machine paths, obsolete topology, and unsupported pass claims |
| `node_modules`, build output, `dist`, coverage, Expo caches | Generated/dependency output | Recreated by canonical installation and build commands |
| Archives, database dumps, exports, credentials, certificates, private user data | Sensitive/unsafe | Prohibited from publication |

## Divergent-ref reconciliation

| Legacy ref/tip | Unique content | Decision |
| --- | --- | --- |
| `c0b44da` People identity | Migration `0007`, mention pipeline, People/Notes/Patterns/Search routes and tests | Already present at `c6b5349`; retained and hardened in `f26e7bb` |
| `46fbded` Perspective doctrines | Prompt and perspective-compliance rules | Already present at `c6b5349`; retained with stronger entitlement and quota enforcement |
| `43f805b` doctrinal/import aliases | README doctrine documentation | Documentation-only and superseded by canonical docs |
| `4501797` backend snapshot | 32 legacy `server/` files | All have equivalents under `services/api`; superseded |
| Mobile gitlink `82f6fdbe` | Flattened mobile app | 74 mapped files identical, 11 intentionally hardened, all 30 shipping assets retained |
| Unadopted proposed web tabs | Home/Patterns/Settings proposal | Excluded because it conflicts with the approved Categories/plus/Profile navigation model |
| Repository-safety, main/develop, and security/verification subagent refs | Ancestor work | Already contained in the reviewed source tree |

No legacy branch or commit is to be cherry-picked into this repository.

## Functional recovery results

The recovery branch now includes:

- Native StoreKit purchase and restore with backend verification before transaction completion, server allowlists, subscription ownership, replay protection, refund handling, and `appAccountToken` binding.
- Real Receipt/Screenshot selection, authorized binary upload, confirmation, canonical listing/deletion, and explicit OCR processing/blocked/unavailable/ready states. No fabricated file or OCR success remains.
- Backend-backed Patterns and one canonical Search endpoint covering Box titles, Notes, Add More context, People, and explicitly stored clean OCR text.
- Device privacy lock, panic hide, encrypted authenticated local domain storage, corruption preservation, encrypted offline mutation queues, and reconnect draining.
- Stable export and account-deletion polling contracts and client recovery.
- Canonical Categories/Add Note/Profile navigation and corrected async Note/Person identity handling.
- Server-enforced StoreKit/entitlement behavior, canonical Perspective generation, and removal of fabricated Perspective fallbacks.

## Verification evidence

Verified on July 21, 2026 with Node 22.22.0 and npm 10.9.x:

- `npm run verify`: passed.
- Repository governance, secret-placeholder, package-lock, test-classification, migration, and repository-integrity checks: passed.
- Mobile lint and TypeScript: passed.
- Mobile tests: 7 files, 26 tests passed.
- API lint, TypeScript build, and unit tests: passed; 6 files, 58 tests.
- Docker/Testcontainers integration tests: passed; 23 files, 160 tests.
- Migration integrity: 14 ordered migrations (5 generated, 9 manual).
- Expo SDK dependency compatibility: passed.
- API production dependency audit: 0 findings.
- Mobile production dependency audit: no high or critical findings. Fourteen moderate findings remain in the Expo SDK 54 build/configuration dependency chain; npm's available remediation is the coordinated Expo SDK 57 upgrade, which is intentionally a separate platform-upgrade change rather than an automatic recovery patch. CI rejects any future high or critical production advisory.

## Deployment prerequisites outside source control

Repository publication does not supply production credentials or third-party console configuration. StoreKit activation still requires matching App Store Connect product and bundle/app identifiers, production Apple root certificates, App Store Server Notifications V2, and the Sign in with Apple team/key/private-key settings documented in the environment examples. These values must remain outside Git.

## Publication gate

This branch must not be pushed until its complete reachable history passes gitlink, nested-repository, disclosure, private-data, size, LFS, case-collision, Windows-path, line-ending, installation, build, migration, and required-test checks. Any unresolved manifest difference blocks publication.
