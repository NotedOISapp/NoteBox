# Haptics

Status: shell only.

Purpose:
Shared haptic feedback primitives used across features to provide consistent tactile responses on iOS.

Allowed:
- reusable, cross-feature code only

Forbidden:
- feature-specific business logic
- screen-specific state
- API behavior owned by one feature
- product doctrine changes
- prototype-only runtime behavior
- Vite/browser-only behavior
