# Mobile Features

This directory contains production feature domains for NoteBox.

Status: shell only.

No runtime behavior has been moved yet.

Feature extraction must happen one domain at a time, with tests and route smoke verification.

The current frontend prototype is still being fine-tuned separately. Prototype behavior must not be copied here until a focused prototype integration audit classifies what is portable.

Expo Router files in `src/app` remain the active runtime entry points until a focused extraction task moves a screen into its feature folder.

Approved domains:
- auth
- age-gate
- onboarding
- sample-demo
- home
- boxes
- categories
- notes
- add-more
- receipts
- people
- perspectives
- search
- patterns
- profile
- privacy
- billing
