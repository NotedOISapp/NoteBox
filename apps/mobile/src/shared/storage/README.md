# Storage

Status: shell only.

Purpose:
Shared local storage abstraction including async storage wrappers, encryption helpers, and offline queue primitives.

Allowed:
- reusable, cross-feature code only

Forbidden:
- feature-specific business logic
- screen-specific state
- API behavior owned by one feature
- product doctrine changes
- prototype-only runtime behavior
- Vite/browser-only behavior
