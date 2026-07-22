# Feature Flags

Feature flags are required for risky or server-controlled behavior.

Use feature flags for:

- AI generation
- Patterns
- OCR
- Receipt Use in response
- Export jobs
- New onboarding flows
- Paywall variants
- New search behavior
- New entitlement behavior

Rules:

Feature flags must not weaken privacy.

Feature flags must not bypass entitlement enforcement.

Feature flags must not replace server-side authorization.

Server-side enforcement always wins.

Every risky feature must have an off switch before production release.
