# Testing

Status: shell only.

Purpose:
Shared test utilities, mock factories, render helpers, and fixture data used across all feature test suites.

Allowed:
- reusable, cross-feature code only

Forbidden:
- feature-specific business logic
- screen-specific state
- API behavior owned by one feature
- product doctrine changes
- prototype-only runtime behavior
- Vite/browser-only behavior
