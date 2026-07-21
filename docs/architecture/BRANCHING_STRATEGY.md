# NoteBox Branching Strategy

## main

Production-ready source of truth.

Rules:

- Protected
- Always releasable
- No direct pushes
- No force pushes
- No experimental work
- Release tags are cut only from main

## develop

Integration branch.

Rules:

- Feature branches merge here first
- Full CI must pass before merge
- Used to detect feature conflicts before main
- Protected once configured in GitHub

## feature/*

For isolated features.

Rules:

- Branch from develop
- Keep narrow
- Include tests
- Do not merge directly to main

## bugfix/*

For normal bug fixes before release.

Rules:

- Branch from develop
- Start with a failing regression test
- Merge through pull request

## hotfix/*

For production emergencies.

Rules:

- Branch from main
- Fix only the production issue
- Start with a failing regression test unless explicitly approved
- Pass hotfix workflow
- Merge into main
- Merge back into develop
- Tag patch release

## release/*

For TestFlight and App Store stabilization.

Rules:

- Branch from develop
- No new features
- Only release blockers, version updates, and build fixes
- Must pass release candidate workflow
- Merge into main after approval
- Merge back into develop
