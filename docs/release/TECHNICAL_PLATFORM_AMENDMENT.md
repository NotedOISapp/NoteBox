# Technical Platform Amendment

NoteBox v1 remains iOS-first and App Store-bound.

Approved implementation path:

- React Native
- Expo EAS Development Builds
- TestFlight for iPhone review
- App Store deployment through the founder-owned or NoteBox-owned Apple Developer Program account

Not approved for production v1:

- Expo Go only
- Pure no-code production build
- Stripe checkout inside iOS
- Local-only prototype
- Any workflow that prevents StoreKit, Sign in with Apple, panic hide, local encrypted drafts, haptics, secure storage, or App Store compliance

## Founder workflow

The founder is working from a PC inside Google Antigravity and needs to review working iOS builds without owning a Mac.

Founder review methods:

- Figma for visual screen review
- Google Antigravity generated screenshots or recorded walkthroughs for flow review
- Expo EAS internal builds or TestFlight for real iPhone review
- Founder does not need to own a Mac
- Founder or NoteBox business entity must own the Apple Developer account

## Apple Developer ownership

The Apple Developer Program account must be owned by the founder or NoteBox business entity.

Builders, contractors, or tooling may be granted access, but they must not own:

- App listing
- Bundle identifier
- Certificates
- App Store Connect account
- Subscription products
- Revenue ownership

## Native fallback rule

If React Native + Expo EAS cannot cleanly satisfy any required native behavior, escalate that feature to a custom native module or SwiftUI/native iOS implementation.

Must prove before v1 approval:

- StoreKit subscriptions
- Restore Purchases
- Manage Subscription
- Sign in with Apple
- Face ID / Touch ID
- App switcher blur
- Panic hide
- Native haptics
- Encrypted local drafts
- Secure storage
- Native dictation or acceptable iOS dictation support
- Image picker
- Document picker
- OCR consent flow
- TestFlight delivery
- App Store compliance
- Server-side entitlement enforcement
