# NoteBox

NoteBox is an iOS-first private system for emotional continuity.

Users create Boxes for people, situations, topics, or events. Inside each Box, they save Notes. Notes can include Receipts, screenshots, files, People tags, Add more blocks, and AI Perspectives.

The core promise:

**Empowerment through having everything together.**

The record comes first. AI comes second.

If AI disappeared, the user's saved Notes, Receipts, People tags, Search, Boxes, Add more blocks, exports, and continuity should still make NoteBox valuable.

---

## Production workflow

NoteBox uses protected branch development.

- `main` is production-ready only.
- `develop` is integration.
- `feature/*` is for isolated features.
- `bugfix/*` is for normal bug fixes.
- `hotfix/*` is for production emergencies.
- `release/*` is for TestFlight and App Store release candidates.

Do not push directly to `main`.

Read `AGENTS.md` and `docs/release/RELEASE_PROCESS.md` before changing code.

---

## Product Status

Status: v1 build
Platform: iOS first
Deployment target: Apple App Store
Founder workflow: PC-based review through Google Antigravity, Expo EAS builds, TestFlight, and iPhone testing
Production build path: React Native + Expo EAS Development Builds
Production runtime: Not Expo Go only

---

## Repository Boundaries

The repository is a segmented workspace with independent dependency trees and ownership:

- `services/api/` is the backend. It owns authentication, authorization, persistence, migrations, Receipt processing, Search, Perspectives, entitlements, exports, workers, and server-side enforcement.
- `apps/mobile/` is the current iOS-first frontend. It owns React Native/Expo screens, device privacy, encrypted offline behavior, StoreKit presentation, and API consumption. It does not replace backend enforcement.
- `.github/`, `scripts/`, and `docs/` are repository governance, verification, and canonical documentation—not application runtime code.

A future web frontend must be added as its own application boundary (for example `apps/web/`) with its own manifest, lockfile, tests, owners, and feature branches. It must consume the backend contract rather than importing backend internals. Backend, mobile, and future-web changes should remain separate focused pull requests whenever their contracts allow it.

---

## What NoteBox Is

NoteBox is a private record system for users who want to capture moments, receipts, and context before memory softens or rewrites the details.

It is built around this arc:

**Spiral -> Record -> Perspective -> Clarity -> Empowerment**

Users can:

- Create Boxes for people, situations, topics, or events
- Save Notes inside Boxes
- Attach Receipts, screenshots, PDFs, audio files, safe docs, and links
- Tag People across Boxes and Notes
- Add more context later without overwriting the original Note
- Search globally and inside a Box
- View three AI Perspectives after saving a Note
- Use paid Patterns to identify recurring dynamics with proof snippets

---

## What NoteBox Is Not

NoteBox is not:

- A therapy app
- A mood tracker
- A chat companion
- A gratitude journal
- A habit tracker
- A streak app
- A social app
- A legal evidence app
- A dashboard
- A prompt feed
- A roast machine

NoteBox is record-first, AI-second.

---

## User-Facing Terms

Use these terms in UI:

- Box
- Note
- Add more
- Receipts
- People
- Perspective
- Aligned
- Objective
- Unfiltered

Avoid these terms in UI:

- Container
- Entry
- Addendum
- Attachment
- Journal
- Mood
- Therapy
- Reflection prompt
- Relationship
- Evidence
- Case file
- Diagnosis

Internal code may use technical names, but user-facing UI must use NoteBox terms.

---

## Core Screens

### Home

Home includes:

- Global search bar
- Horizontal Box carousel
- Recent Notes for the selected Box
- Floating Add Note button

Home must not become:

- A mood tracker
- A prompt feed
- A dashboard
- A social feed
- An analytics page

### Box Detail

Box Detail includes:

- Box name
- Optional avatar or photo
- People chips
- Notes list, newest first by default
- Ellipsis menu for Search, Sort, Rename, Archive, Export, Delete

People chips can filter Notes within the Box.

### Note Composer

The composer includes:

- Box selector pill
- Large text field
- Add Screenshot
- Add Receipt
- Tag People
- Native dictation support where feasible
- Save Note CTA

Draft autosave is mandatory.

Drafts must survive:

- Backgrounding
- App lock
- Crash
- Panic hide
- Network failure
- Dictation interruption where technically feasible

No live moderation, AI suggestions, prompts, warning banners, or emotion labels while typing.

### Note Detail

Note Detail includes:

- Latest Note body
- Last updated timestamp
- Add more blocks
- Receipts strip
- Perspective section

Note actions:

- Edit, paid and trial only
- Add more, all plans
- Version History, paid and trial
- Revert, paid and trial
- Export Note, paid and trial
- Copy Text, all plans
- Delete, soft delete

---

## Perspective System

No chat thread in v1.

After saving a Note, NoteBox generates all three Perspectives:

### Aligned

**Feel understood, right now.**

Purpose:

- Validate
- Support
- Reinforce
- Help the user feel less alone
- Avoid fluff
- Avoid therapy language

### Objective

**Outside perspective.**

Purpose:

- Offer a neutral lens
- Give a clean read
- Provide a good-faith devil's advocate angle when appropriate
- Avoid automatically siding with the user
- Avoid coldness

### Unfiltered

**No holding back.**

Purpose:

- Call out behavior, patterns, excuses, dynamics, or double standards
- Use controlled bite
- Stay grounded in the Note
- Help the user stop excusing what happened

Unfiltered must not:

- Encourage harassment
- Encourage revenge
- Encourage stalking
- Encourage doxxing
- Encourage violence
- Use slurs
- Diagnose people as fact
- Become cruelty for entertainment

Unfiltered is sharp. It is not a roast machine.

---

## Unfiltered Intensity

Levels:

- Mild
- Bold
- Savage

Default:

- Bold

Rules:

- No global saved default
- No per-Box saved default
- No "remember my tone" setting
- Free users see the control but are locked to Bold
- Paid and trial users can select Mild, Bold, or Savage

---

## Search

Search is required.

Global search covers:

- Note text, latest version
- Add more blocks
- Box titles
- People names
- Extracted OCR text, only if extracted

In-Box search uses the same behavior scoped to one Box.

Search results must:

- Group by Box
- Show snippet
- Highlight keyword
- Open Note at match location

---

## Receipts and OCR

Receipts are attachments connected to Notes.

Supported in v1:

- Images
- Screenshots
- PDFs
- Audio files
- Safe docs
- Links with rich preview

Not supported in v1:

- Video
- Screen recordings

OCR rules:

- Receipts are never auto-analyzed
- OCR runs only when user taps Extract text or Use in response
- Extracted text must be deletable without deleting the Receipt
- Receipts are included in AI only when user enables Use in response

Paper clip rule:

- Paper clip appears only on individual Notes that have Receipts
- Paper clip does not appear on Box cards

---

## Free, Trial, and Paid Rules

### Free

- 5 active Boxes
- 5 Notes per Box
- Box locks for writing after 5th Note
- Existing content remains readable forever
- 3 Receipts per Note
- 250MB storage
- View all 3 Perspectives
- Unfiltered default Bold only
- 1 regen token per Note total
- Cannot edit Note text post-trial
- Can add more
- Export: copy text only
- No Patterns tab

### Trial

- 14 days
- Full access
- No Box cap
- No Notes cap
- 10 Receipts per Note
- 5GB storage
- Unlimited regen
- Editing
- Version history
- Revert
- All Unfiltered intensities
- Scope controls
- Patterns
- PDF export
- Data ZIP

### Paid

- No Box cap
- No Notes cap
- 10 Receipts per Note
- 5GB storage
- 5 regen per Note per state
- Editing
- Version history
- Revert
- All Unfiltered intensities
- Scope controls
- Patterns
- PDF export
- Data ZIP

All entitlements must be enforced server-side.

---

## Billing

iOS billing uses StoreKit only.

No Stripe checkout inside the iOS app.

Required:

- StoreKit subscription flow
- Restore Purchases
- Manage Subscription
- Backend receipt verification
- Backend entitlement assignment
- Privacy Policy URL
- Terms URL
- Support URL

Stripe may be added later for web, mapped through the same entitlement system.

---

## Technical Stack

Approved v1 path:

- React Native
- Expo EAS Development Builds
- TypeScript
- TestFlight for iPhone review
- App Store deployment through founder-owned or NoteBox-owned Apple Developer Program account

Not approved for production:

- Expo Go only
- Pure no-code final app
- Local-only prototype
- Stripe checkout inside iOS

Native fallback:

If React Native + Expo EAS cannot cleanly satisfy required native behavior, escalate to a custom native module or SwiftUI/native iOS implementation for that feature.

Required native proof points:

- StoreKit
- Sign in with Apple
- Face ID / Touch ID
- App switcher blur
- Panic hide
- Native haptics
- Secure storage
- Encrypted local drafts
- Image picker
- Document picker
- TestFlight delivery
- App Store compliance

---

## Backend Requirements

Backend is mandatory.

Core entities:

- User
- Subscription
- Entitlement
- Box
- Person
- BoxPerson
- Note
- NoteVersion
- AddMore
- NotePerson
- Receipt
- OCRText
- AIResponse
- RegenUsage
- PatternInsight
- SearchIndex
- ExportJob
- SafetyResourceInteraction
- AnalyticsEvent

Core API areas:

- Auth
- Boxes
- People
- Notes
- Note versions
- Add more
- Receipts
- OCR
- AI generation
- Regen
- Patterns
- Search
- Export
- Settings
- Admin

---

## Privacy and Security

Required:

- Sign in with Apple
- TLS in transit
- Encryption at rest
- Local drafts stored encrypted
- Secure storage for auth and lock credentials
- App switcher blur
- Panic hide
- Face ID / Touch ID
- PIN and passcode options
- No custom end-to-end encryption in v1

Panic hide:

- Backgrounding or locking the phone blurs the app switcher
- Draft autosaves
- Nothing is deleted
- User returns to where they were
- If privacy lock is enabled, return opens privacy lock screen

Panic hide is not panic delete.

---

## Analytics

Track actions only.

Never track private Note text.

Private content must never be sent as analytics payload.

Private content must not be used for model training by default.

---

## Accessibility

Required:

- Dynamic Type
- High contrast support
- Minimum 44 x 44 tap targets
- Screen reader labels
- Reduced motion support
- Sufficient color contrast
- No metallic text for body copy

---

## App Store Positioning

Category:

Lifestyle

Not:

- Health & Fitness
- Safety

Avoid App Store messaging around:

- Therapy
- Healing
- Mental health
- Gratitude
- Mood tracker
- AI companion
- Coach
- Best friend
- Journaling prompts

Use messaging around:

- Private record
- Pattern clarity
- Keep everything together
- Notes and receipts
- Perspective is optional
- Record is primary

Potential subtitle:

Private Record & Pattern Clarity

Potential tagline:

Not your therapist. Not your cheerleader. Your private record.

---

## Google Antigravity Workstreams

Google Antigravity should execute the build as a multi-agent mission.

Workstreams:

- Product Spec Agent
- UX Systems Agent
- Visual Design Agent
- Frontend iOS Agent
- Backend Engineering Agent
- AI Prompting Agent
- QA Agent
- Growth and SEO Agent

Frontend iOS Agent owns:

- React Native + Expo EAS implementation
- iOS-first UI behavior
- Carousel performance
- Draft autosave
- Panic hide
- Privacy lock
- Search UI
- Export UI
- Dictation support
- Attachments
- StoreKit integration path
- Haptics
- Native module escalation if needed
- TestFlight delivery pipeline coordination

---

## QA Ship Blockers

A build fails QA if:

- App only runs in Expo Go
- App cannot produce an Expo EAS Development Build
- App cannot be distributed to founder's iPhone through TestFlight or approved internal build flow
- Apple Developer ownership sits with a third party
- StoreKit cannot be tested end-to-end
- Sign in with Apple cannot be tested end-to-end
- Panic hide relies on unsupported workaround
- Secure drafts rely on unsupported workaround
- Haptics rely on unsupported workaround
- Draft is lost after backgrounding, crash, or lock
- OCR runs automatically
- Receipt is used in AI without Use in response
- Search misses Add more, People names, or extracted OCR
- Free locked Box hides old content
- Regen limits are client-only
- Three Perspectives do not generate after Save
- Chat thread appears
- Patterns show claims without proof snippets
- Private Note text is sent to analytics
- App uses therapy copy
- Home becomes a mood tracker, dashboard, or prompt feed
- Paper clip appears on Box cards
- Blue becomes the primary accent
- Rose gold is used as body text

---

## Build Acceptance Summary

A v1 build is acceptable only when a user can:

1. Sign in with Apple.
2. Create a Box.
3. Add a Note within 3 taps from activation flow.
4. Save a Note and see all three Perspectives.
5. Understand each Perspective before selecting it.
6. Add Receipts without automatic analysis.
7. Search globally and inside a Box.
8. Highlight a searched word inside a Note.
9. Sort Notes newest or oldest and filter by date range inside a Box.
10. Add People and tag them in Boxes and Notes.
11. See paper clip only on Notes with Receipts.
12. Hit free limits and still read all old content.
13. Upgrade through StoreKit.
14. Restore purchases.
15. Use panic hide without losing drafts.
16. Export content if paid or trial.
17. Access Patterns if paid.
18. Trust that private text is not analytics data.
19. Use the app without therapy-coded prompts, mood tracking, chat loops, or fluff.
20. Review a real iPhone build through TestFlight or approved Expo EAS internal build flow.
21. Ship through a founder-owned or NoteBox-owned Apple Developer Program account.

---

## Local Development

Install the independent mobile and backend dependency trees from their lockfiles:

```bash
npm run mobile:install
npm run api:install
```

Start the mobile development server:

```bash
cd apps/mobile
npm start
```

Run the complete repository gate (integrations require Docker):

```bash
npm run verify
```

Create an EAS development build:

```bash
eas build --profile development --platform ios
```

Create a production iOS build:

```bash
eas build --profile production --platform ios
```

Submit to App Store Connect:

```bash
eas submit --platform ios
```

---

## Environment Variables

Never commit real secrets.

Create a local `.env` file from `.env.example`.

Required variables should be documented in `.env.example`.

Example:

```bash
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_APP_ENV=
```

Only public Expo variables should use the `EXPO_PUBLIC_` prefix.

Server secrets, Apple private keys, AI provider keys, database credentials, storage credentials, and webhook secrets must never be committed to GitHub.

Use Expo/EAS secret management and backend secret storage for sensitive values.

---

## Repository Rule

This repo should remain private unless intentionally sanitized for public release.

Do not commit:

- Real `.env` files
- Apple certificates
- Provisioning profiles
- API keys
- Private keys
- Database credentials
- AI provider keys
- Production user data
- Exported user data
- Crash dumps with private text
- Screenshots containing real user notes
