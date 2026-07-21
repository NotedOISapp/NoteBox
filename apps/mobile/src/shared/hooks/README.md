# Hooks

Status: shell only.

Purpose:
Reusable React hooks that are not owned by any single feature domain, such as useDebounce, useAppState, and useNetworkStatus.

Allowed:
- reusable, cross-feature code only

Forbidden:
- feature-specific business logic
- screen-specific state
- API behavior owned by one feature
- product doctrine changes
- prototype-only runtime behavior
- Vite/browser-only behavior
