# Onboarding

Status: shell only. No runtime behavior has been moved into this folder yet.

Purpose:
Owns the first-run setup experience that configures the user's NoteBox before the Home screen is shown.

Owns, eventually:
- Screens:
- Components:
- State:
- API calls:
- Selectors:
- Hooks:
- Tests:

Must not own:
- Cross-feature shared UI primitives
- Backend contracts
- Product behavior outside this domain
- Prototype-only logic
- Web-only behavior from the Vite prototype

Migration rule:
Do not move behavior into this folder without a focused extraction task, acceptance tests, route-level smoke verification, and, when relevant, frontend prototype mapping.
