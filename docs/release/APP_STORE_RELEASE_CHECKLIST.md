# App Store Release Checklist

Release version:
Build number:
Release branch:
Commit SHA:

## Required checks

- [ ] Release branch created from the current verified `main`
- [ ] No new features added after release branch
- [ ] Full CI passed
- [ ] Release candidate workflow passed
- [ ] Mobile build passed
- [ ] Backend build passed
- [ ] Typecheck passed
- [ ] Lint passed
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] Coverage passed
- [ ] No skipped tests
- [ ] No `.only`
- [ ] No lowered coverage thresholds
- [ ] No secrets committed
- [ ] TestFlight build installed on real iPhone
- [ ] Sign in with Apple tested
- [ ] StoreKit purchase tested
- [ ] Restore purchases tested
- [ ] Free limits tested
- [ ] Entitlements tested
- [ ] Account deletion tested
- [ ] Draft autosave tested
- [ ] Panic hide tested
- [ ] Receipt attach tested
- [ ] OCR consent tested
- [ ] Receipt Use in response tested
- [ ] Search tested
- [ ] AI scope tested
- [ ] Analytics privacy checked
- [ ] App switcher blur tested
- [ ] Privacy Policy URL checked
- [ ] Terms URL checked
- [ ] Support URL checked
- [ ] App Store privacy labels reviewed
- [ ] Founder approval recorded

## Release decision

- [ ] Approved
- [ ] Blocked

Founder approval:
Date:
