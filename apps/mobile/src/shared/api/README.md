# API

Status: shell only.

Purpose:
Shared API client configuration, auth token injection, retry logic, and base request helpers used by all feature API layers.

Allowed:
- reusable, cross-feature code only

Forbidden:
- feature-specific business logic
- screen-specific state
- API behavior owned by one feature
- product doctrine changes
- prototype-only runtime behavior
- Vite/browser-only behavior
