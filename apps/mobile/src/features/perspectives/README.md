# Perspectives

Status: shell only. No runtime behavior has been moved into this folder yet.

Purpose:
Owns Perspective cards, generated Aligned, Objective, and Unfiltered response display, Perspective Expanded modal behavior, regen controls, scope controls, Unfiltered intensity UI, and safety-aware display states.

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
