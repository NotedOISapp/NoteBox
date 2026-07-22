# NoteBox Release Process

## Normal release

1. Merge completed features into develop.
2. Confirm develop CI passes.
3. Create release/x.y.z from develop.
4. Freeze features.
5. Run release candidate workflow.
6. Build TestFlight candidate.
7. Founder tests on real iPhone.
8. Fix release blockers only.
9. Merge release branch into main.
10. Tag release from main.
11. Submit to App Store.
12. Merge main back into develop.

## Hotfix release

1. Confirm live production issue.
2. Create hotfix/x.y.z-description from main.
3. Write failing regression test.
4. Apply smallest safe fix.
5. Run hotfix workflow.
6. Build patch candidate.
7. Founder verifies on real iPhone.
8. Merge hotfix into main.
9. Tag patch release.
10. Merge main back into develop.
11. Document incident.

## Rollback options

Use the safest available rollback:

- Revert commit
- Disable feature flag
- Roll back backend config
- Pause App Store phased release
- Submit patch release
- Disable risky server-side feature
- Roll back migration only if rollback was designed and tested

## Absolute rule

No App Store submission may rely on a feature branch alone.

The release candidate must be tested after all intended changes are integrated.
