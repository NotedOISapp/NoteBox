# Incident Response

## Severity levels

SEV0:
Private data exposure, auth bypass, cross-user access, private content leak.

SEV1:
Production app unusable, StoreKit broken, account deletion broken, login broken.

SEV2:
Major feature broken, draft loss risk, sync issue, search authorization issue.

SEV3:
Minor bug, visual issue, non-critical regression.

## Required response

For every incident:

1. Assign severity.
2. Stop unrelated releases.
3. Create bug or hotfix branch.
4. Write failing regression test.
5. Apply smallest safe fix.
6. Run required verification.
7. Document root cause.
8. Add prevention test.
9. Merge through approved path.
10. Record release or hotfix evidence.

## SEV0 rule

SEV0 requires immediate release freeze.

No feature work continues until the issue is contained.
