# Categories

Status: shell only. No runtime behavior has been moved into this folder yet.

Purpose:
Owns Box category grouping, the Home category rail, Category Detail behavior, category empty states, and filtering Boxes by All, Work, Personal, Family, or custom categories.

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
