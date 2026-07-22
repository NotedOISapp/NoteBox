# NoteBox Release Process

## Normal Release

1. Merge each intended feature or bug fix into `main` through a focused pull request.
2. Confirm `main` CI passes and the intended release scope is complete.
3. Create `release/x.y.z` from that verified `main` commit.
4. Freeze features.
5. Run the release-candidate workflow.
6. Build the TestFlight candidate.
7. Have the founder test it on a real iPhone.
8. Fix release blockers only on the release branch, with regression tests.
9. Merge the release pull request into `main` after approval.
10. Tag the resulting `main` commit.
11. Submit the verified build to the App Store.

## Hotfix Release

1. Confirm the live production issue.
2. Create `hotfix/<area>-<description>` from `main`.
3. Write a failing regression test.
4. Apply the smallest safe fix.
5. Run the hotfix workflow.
6. Build the patch candidate.
7. Have the founder verify it on a real iPhone.
8. Merge the hotfix pull request into `main`.
9. Tag the resulting patch release.
10. Document the incident.

## Rollback Options

Use the safest available rollback:

- Revert a pull request
- Disable a feature flag
- Roll back backend configuration
- Pause an App Store phased release
- Submit a patch release
- Disable a risky server-side feature
- Roll back a migration only if rollback was designed and tested

## Absolute Rule

No App Store submission may rely on a feature branch alone.

The release candidate must be tested after all intended changes are integrated.
