# NoteBox v1 Master Handoff, v3.4

Audience: Google Antigravity agents, product, design, frontend, backend, AI, QA, App Store, and marketing
Status: Canonical v3.4 production handoff, preserving the working v2 user flow, incorporating v3.3 hygiene fixes, and locking the finalized brand-line doctrine
Platform: iOS-first, App Store-bound
Founder workflow: PC-based review through Google Antigravity, Figma, Expo EAS builds, TestFlight, and iPhone testing
Product name: NoteBox
Previous project name: Noted

Rule: If something is not in this document, it is not part of v1 unless explicitly approved later.

## Repository-wide production safety doctrine

The NoteBox repository must use protected branch development.

The canonical production branch is `main`.

No direct pushes to `main` are allowed.

All production changes must go through pull requests.

All production-code changes require Evidence-Based TDD.

All releases require a release branch and release candidate verification.

All production hotfixes require a hotfix branch, regression test, verification, merge to main, and merge back to develop.

A passing feature branch is not a passing application.

A targeted test run is not release verification.

No TestFlight or App Store submission may proceed until the integrated release candidate passes the full release gate.

---

## v3.4 build directive, read before coding

This v3.4 handoff **does not redesign the working product**.

The v2 screen flow, locked Home system, colors, components, no-scroll rule, bottom dock, carousel, Notes, Receipts, People, Perspectives, Categories, Profile, Upgrade, Patterns preview, and privacy return remain the working foundation.

The purpose of v3.4 is to harden the doctrine before more code is written so Antigravity does not bake avoidable App Store, privacy, entitlement, AI, data-retention, or account-deletion mistakes into the architecture.

Implementation rule:

```text
Do not rebuild the app from scratch.
Do not change the settled visual direction.
Do not replace the working flow.
Patch only the missing doctrine, data safety, compliance, and entitlement rails defined in this v3.4 handoff.
```

Critical v3.4 additions:

- Lightweight adult eligibility gate, self-attestation only.
- In-app account deletion.
- Provider data-retention wording that does not overpromise privacy.
- SecureStore limits and stale-token handling.
- Audio recording and transcription consent.
- No social, no public user-generated-content distribution.
- Bell/status icon clarification.
- Profile absorbs settings and must include Data and Export.
- Data deletion, export, and account deletion must be designed before App Store submission.
- Safety resources must match launch geography, or launch geography must be limited.
- Multisensory feedback sync rule restored.
- Compliance QA lane added.
- Brand-line stack locked: App Store subtitle, Home tagline, onboarding support line.

---

## 0. Read this first

NoteBox is a private system for emotional continuity.

It is not a generic notes app.
It is not a therapy app.
It is not a mood tracker.
It is not an AI chat companion.
It is not a legal evidence product.
It is not a social app.
It is not a productivity dashboard.

NoteBox exists for users who feel something happen, cannot fully process it in the moment, and need somewhere controlled to put the note, the receipts, the people, and the context so the moment does not disappear or get rewritten by memory.

The product spine is:

```text
Spiral -> Record -> Perspective -> Clarity -> Empowerment
```

The core promise is:

```text
Empowerment through having everything together.
```

The record comes first. AI comes second.

If AI disappeared tomorrow, the user's saved Notes, Receipts, People tags, Search, Boxes, Add more blocks, exports, and continuity must still make NoteBox valuable.

---

## 1. Canonical v2/v3.4 changes

This v3.4 handoff preserves the working v2 user flow board and visual direction, then adds the minimum build-safety doctrine needed before App Store-bound coding continues.

### New locked navigation model

The Home bottom dock is:

```text
Categories        +        Profile
```

This replaces the older visible bottom tab idea of Home, Patterns, Settings.

Interpretation:

- Home is the default landing screen and does not need a visible Home tab while on Home.
- Categories is a primary Home control for grouped Boxes.
- The center plus is the primary Add Note action.
- Profile is the user-facing account and settings entry.
- Patterns are paid-only and not a default free-user tab.
- Settings are accessed through Profile.

### New locked visual model

The v2 Home uses:

- Warm textured ivory background
- NoteBox icon with rose-gold flap and deep charcoal inner shape
- Editorial serif wordmark
- Connected search and category tray
- Circular floating Box carousel
- Compact Recent Notes card
- Slim bottom dock
- Rose-gold plus button
- Soft glass and neumorphic surfaces

### New locked flow model

The working product flow contains 24 fixed product screens plus one required adult eligibility gate after Sign In:

1. Splash
2. Sign In
Gate A. Adult Eligibility, required but not counted as a product screen
3. Create First Box
4. First Note Composer
5. Add Receipt Sheet
6. Tag People Sheet
7. Save Success and Perspective Intro
8. Note Detail
9. Perspective Expanded Modal
10. Home
11. Search
12. Categories
13. Category Detail
14. Box Detail
15. Add More Modal
16. Locked Box Modal
17. Upgrade
18. Patterns Preview
19. Pattern Detail
20. Profile
21. Privacy and Security
22. Privacy Return
23. View All Boxes
24. View All Recent Notes

### No-scroll rule

Primary screens do not vertically scroll.

Long content uses:

- Focused reader modal
- Paged modal
- Horizontal carousel
- Horizontal rail
- Bottom sheet
- Result pagination
- Compact preview with View all
- Segmented tabs

### Canonical v3.4 hardening changes

The following additions are now part of the production doctrine and must be implemented without changing the already-working visual flow:

1. Add Age Eligibility after Sign in with Apple and before Create First Box.
2. Add Delete Account inside Profile -> Data and Export.
3. Clarify that the Home bell/status icon is in-app status only, not push notifications.
4. Add explicit no-social rule to avoid UGC moderation obligations in v1.
5. Add audio receipt consent rules.
6. Add AI provider data-retention wording.
7. Add SecureStore limits and stale-token handling.
8. Add account deletion and data deletion acceptance criteria.
9. Add backend APIs and analytics events for adult eligibility and account deletion.
10. Add launch geography rule for crisis resource cards.
11. Restore multisensory sync timing from the original haptics doctrine.
12. Add a compliance QA lane.
13. Replace the old Home tagline with the approved brand-line stack.

These changes do not alter the product promise. They protect it.

---

## 2. Product doctrine

### 2.1 What NoteBox is

NoteBox is an iOS-first private system for emotional continuity.

Users create Boxes for people, situations, topics, or events. Inside each Box, they save Notes. Notes can include Receipts, screenshots, files, People tags, Add more blocks, and AI Perspectives.

The purpose is not to escalate, obsess, or fight.

The purpose is to keep the moment together so the user can return later with clarity.

### 2.2 Primary user

Primary ICP:

High-functioning women, roughly 20 to 40, emotionally perceptive, intelligent, private, and not interested in therapy-coded apps.

She may:

- Replay conversations at night
- Notice patterns but not always articulate them yet
- Feel something is off
- Minimize her discomfort
- Forget exact details later
- Gaslight herself over time
- Carry emotional labor
- Want privacy and control
- Reject motivational fluff
- Reject wellness branding
- Reject endless AI chat
- Want something smarter than a journal and calmer than a text thread

### 2.3 What NoteBox is not

NoteBox is not:

- A therapist
- A venting toy
- A roast machine
- A mood tracker
- A chat companion
- A gratitude journal
- A habit tracker
- A streak app
- A pink self-care app
- A domestic abuse evidence app
- A legal case file system
- A social app
- A productivity workspace
- A prompt app
- A dashboard
- A feed

NoteBox is a private record with controlled intelligence layered on top.

### 2.4 Design mandate

Every decision must support:

```text
Empowerment through having everything together.
```

A feature belongs if it:

- Preserves continuity
- Respects intelligence
- Feels private
- Feels controlled
- Supports revisiting
- Builds pattern awareness
- Reduces self-doubt through accumulation
- Keeps the user's words primary
- Helps the user trust what happened without becoming dependent on AI

A feature does not belong if it:

- Encourages spiraling
- Feels chaotic
- Feels infantilizing
- Feels preachy
- Feels like therapy
- Feels like social media
- Pushes prompts
- Turns the app into entertainment
- Creates AI dependency
- Turns Home into a dashboard
- Adds dopamine loops
- Adds streaks
- Makes the user feel watched

---

## 3. Naming, language, and mental model

### 3.1 App name

User-facing app name:

```text
NoteBox
```

Previous internal project name:

```text
Noted
```

All new user-facing product language must use NoteBox.

### 3.2 Mental model

Think of NoteBox like a private shoebox where a user puts notes, receipts, screenshots, memories, and context connected to a person, situation, or event.

The shoebox metaphor should inform structure.

It must not turn the brand cute.

The feeling is:

- Organized
- Private
- Compartmentalized
- Emotional but controlled
- Premium
- Soft but intelligent
- Human without being therapy-coded

The metaphor should not become:

- Scrapbook
- Stationery gimmick
- Juvenile
- Cute wellness
- Decorative clutter
- Craft app
- Memory album
- Case file

### 3.3 User-facing terminology

Use:

- Box
- Note
- Add more
- Receipts
- People
- Perspective
- Aligned
- Objective
- Unfiltered

Avoid:

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
- Incident
- Report
- Diagnosis
- Abuse log
- Mental health record

### 3.4 Internal terminology mapping

Backend and internal code may use canonical system terms if needed, but UI must use NoteBox terms.

```text
Container -> Box
Entry -> Note
Addendum -> Add more
Attachment -> Receipt
Person profile -> Person
AI response -> Perspective
```

### 3.5 Box naming rule

Box cards show the clean name only.

Examples:

- Andy
- Work
- Mom
- School
- Wedding weekend
- Apartment
- Boss
- Co-parenting

Do not display "Andy's Box" everywhere.

Use "Box" only in supporting copy, empty states, and instructional UI.

Correct:

```text
Card title: Andy
Empty state: Nothing in this Box yet.
CTA: Add Note
```

Incorrect:

```text
Andy's Box
Work Box
Relationship Box
Emotional Container
```

### 3.6 Tone rules

Tone is:

- Premium
- Editorial
- Composed
- Direct
- Slightly sassy when appropriate
- Controlled
- Adult
- Emotionally aware without being therapy-coded
- Warm, but not fluffy

Tone is not:

- Motivational
- Preachy
- Clinical
- Cute
- Overly soft
- Infantilizing
- Wellness-branded
- Overly forensic
- Legalistic
- Meme-like
- Mean for entertainment

---

## 4. Technical platform lock

### 4.1 Platform status

NoteBox v1 is iOS-first and App Store-bound.

The app must be shippable through Apple App Store review.

The app must support TestFlight for founder and beta tester review.

### 4.2 Founder environment

Founder is working from a PC.

Founder does not need to own a Mac.

Google Antigravity is the development environment and agentic build workspace.

Google Antigravity is not a contractor and not a person. It is the agentic development platform that will execute tasks, generate code, run checks, produce artifacts, and verify implementation.

### 4.3 Approved implementation path

Approved production path for v1:

- React Native
- Expo EAS Development Builds
- Expo EAS cloud build workflow
- TestFlight for iPhone review
- App Store deployment through founder-owned or NoteBox-owned Apple Developer Program account

Not approved for production v1:

- Expo Go only
- Pure no-code production build
- Local-only prototype
- Stripe checkout inside iOS
- Any workflow that blocks StoreKit, Sign in with Apple, panic hide, encrypted drafts, secure storage, haptics, receipts, OCR consent, TestFlight, or App Store compliance

### 4.4 Expo Go is not enough

Expo Go is not approved as the production runtime.

NoteBox requires native capabilities and production app behavior, including:

- StoreKit subscription flow
- Sign in with Apple
- Secure storage
- Local encrypted drafts
- Haptics
- App lifecycle handling
- Panic hide
- App switcher blur
- Image picker
- Document picker
- Audio receipt handling
- TestFlight delivery
- App Store compliance

### 4.5 Native fallback rule

SwiftUI/native iOS remains the fallback path.

Escalate a feature to a custom native module or SwiftUI/native iOS if React Native + Expo EAS cannot cleanly satisfy any required behavior.

Fallback triggers:

- StoreKit cannot be tested end-to-end
- Account deletion endpoint cannot be tested end-to-end
- Adult eligibility gate cannot be tested end-to-end
- Sign in with Apple cannot be implemented cleanly
- Face ID / Touch ID cannot be implemented cleanly
- App switcher blur is unreliable
- Panic hide is unreliable
- Encrypted local drafts are unreliable
- Haptics cannot match spec
- File/photo/document picker behavior is broken
- TestFlight delivery is blocked
- App Store compliance is compromised

### 4.6 Apple Developer Program ownership

An Apple Developer Program account is required.

The account must be owned by:

- Founder, or
- NoteBox business entity

Builders, contractors, tools, or agents may be granted access.

They must not own:

- Apple Developer account
- App Store Connect account
- Bundle identifier
- Certificates
- Provisioning profiles
- Subscription products
- App listing
- Revenue ownership

---

## 5. App structure and navigation

### 5.1 Primary app surfaces

v2 primary surfaces:

- Home
- Search
- Categories
- Category Detail
- Box Detail
- Note Detail
- Composer
- Add More
- Perspectives
- Patterns, paid
- Profile
- Privacy and Security
- Privacy Return
- View All Boxes
- View All Recent Notes

### 5.2 Bottom dock, v2

The Home bottom dock is:

```text
Categories        +        Profile
```

Rules:

- There is no visible Home tab while on Home.
- The center plus opens Composer with the selected Box prefilled.
- Categories opens Categories.
- Profile opens Profile.
- Patterns are not shown as a default free-user bottom tab.
- Settings are accessed through Profile.

### 5.3 Power controls

Power controls live behind contextual ellipsis menus.

Use ellipsis menus on:

- Box Detail
- Note Detail
- Perspective cards
- Pattern insight cards
- Profile subsections when needed

Do not use global hamburger navigation.

Do not hide primary actions behind menus.

Primary actions must remain visible:

- Search
- Add Note
- Save Note
- Perspective selection
- Upgrade CTA when relevant

### 5.4 Primary task rule

Primary task:

```text
Save a Note into a Box.
```

The user must reach this task within 3 taps after required account and adult-eligibility gates are completed.

Home + Add Note defaults to the currently selected Box in the carousel.

Composer opens with a Box selector pill at top.

Example:

```text
Mom
```

User can switch the Box before saving.

---

## 6. Visual design system

### 6.1 Overall vibe

The design should feel like:

- Soft cards
- Calm negative space
- Ovals and soft rectangles
- Warm tactile interface
- Sophisticated
- Feminine-adjacent, not cute
- Premium, but not fake luxury
- Emotionally safe, but not therapy-coded
- Private, not clinical
- Simple, not bare
- Warm ivory, not dark
- Glass plus soft neumorphism

### 6.2 Color palette

Base colors:

```css
--warm-ivory: #F6F2EF;
--soft-cream-card: #FBF8F5;
--charcoal-text: #2E2A28;
--deep-charcoal: #1F2426;
--warm-taupe: #6F6763;
--muted-sage: #C7D4C5;
--muted-blush: #E9C8C2;
--rose-gold-dark: #B76E79;
--rose-gold-mid: #D98D78;
--rose-gold-light: #E8B4B8;
```

No blue accent.

Rose gold replaces gold.

Rose gold should feel like restrained metallic warmth, not glitter.

### 6.3 Rose gold usage rules

Rose gold is allowed only for:

- Primary CTA
- Upgrade CTA
- Add Note plus button
- Selected state highlight
- Subtle underline or highlight
- Important confirmation
- Lock icon accent
- Unfiltered tone selection highlight
- Active carousel dot
- Notification/status dot

Never use rose gold for:

- Paragraph body text
- Large backgrounds
- Charts
- Decorative patterns
- Overly shiny elements
- Glitter
- Chrome effects

### 6.4 Logo icon

The NoteBox icon is locked:

- Top flap: rose gold matching the footer plus
- Inner lower shape: deep charcoal matching the wordmark
- Base tile: soft cream or ivory with neumorphic bevel
- No green in the logo
- No blue in the logo
- No overly literal cardboard box

### 6.5 Shape language

Use:

- Soft rectangles
- Rounded cards
- Oval pills
- Floating circles for primary add actions
- Soft bottom sheets
- Frosted glass trays
- Neumorphic action icons

Avoid:

- Hard edges
- Sharp boxes
- Torn paper textures
- Scrapbook elements
- Decorative clips
- Excessive shadows
- Cards standing on a surface

### 6.6 Paper clip motif

Paper clip is locked as a functional receipt indicator.

Paper clip appears only on individual Notes that have Receipts.

Paper clip does not appear:

- On Box cards
- On Home carousel cards
- On AI Perspective cards
- On Patterns
- On Settings or Profile rows

Meaning:

```text
This Note has Receipts attached.
```

It does not mean:

- Important
- Pinned
- Flagged
- Locked

Style:

- Single-line outline icon
- Small
- Muted charcoal by default
- Rose gold only when receipt section is active or expanded
- No cartoon paper clip
- No oversized stationery look

### 6.7 Typography

Use editorial typography.

Headings may use a refined serif or elevated display style if readable.

Body should use a clean sans serif.

Avoid:

- Thin low-contrast type
- Overly playful fonts
- All caps as default
- Tiny body text

Minimum body text:

```text
16px equivalent on mobile
```

Support Dynamic Type.

### 6.8 Motion

Motion should be subtle.

Use:

- Fade
- Gentle lift
- Soft slide
- Card expansion
- Carousel snap
- Sheet rise

Avoid:

- Bounce
- Elastic effects
- Confetti
- Gamified animation
- Excessive celebration

Routine UI response animations must stay under 300 ms.

Success and milestone animations may be 400 to 600 ms.

---

## 7. Onboarding

Onboarding is split into two phases.

### 7.1 Phase 1: Activation

Goal:

```text
Get the user to the first saved Note quickly.
```

Steps:

1. Create first Box
2. Open composer
3. Save first Note

Rules:

- No paywall before first value.
- No notification permission before value.
- No photo library permission before user taps Add Screenshot, Add Receipt, or Add photo.
- No long explanation before the user has saved something.

### 7.2 Phase 1 screen sequence

#### Splash

- NoteBox logo icon
- NoteBox wordmark
- Warm ivory background

#### Sign In

Primary:

```text
Sign in with Apple
```

Do not implement guest private Notes in v1.

Reason:

NoteBox is private, account-bound, security-sensitive, and entitlement-based.

Correct interpretation of frictionless entry:

- Do not force payment before value.
- Do not ask for unnecessary profile data.
- Do not show paywall before aha moment.
- Let the user create a first Box and first Note only after Sign in with Apple and adult eligibility are complete.

#### Age Eligibility

Placement:

```text
After Sign in with Apple and before Create First Box.
```

Purpose:

Keep NoteBox adult-positioned without collecting unnecessary identity documents or birthdate data.

Screen copy:

```text
Before we start

NoteBox is designed for adults. It may contain private notes, receipts, emotionally sensitive context, and AI-generated perspectives.

[ ] I confirm I am 18 or older.

Continue
```

Footer:

```text
By continuing, you agree to the Terms and Privacy Policy.
```

Rules:

- Self-attestation only in v1.
- No government ID collection.
- No selfie verification.
- No date of birth collection unless counsel explicitly requires it.
- Store only age_attested, age_attested_at, and attestation_version.
- If user does not confirm, do not allow account setup to continue.
- If a minimal auth stub was created before the user declined, sign the user out and delete or anonymize that stub unless legally required to retain it.
- Do not allow Box creation, Note creation, Receipt upload, OCR, Search indexing, Patterns, exports, or AI calls before age attestation is complete.
- Do not make the screen feel punitive, scary, clinical, or legalistic.
- This gate is not a wellness or safety-onboarding screen.

Backend fields:

```text
age_attested: boolean
age_attested_at: timestamp
age_attestation_version: string
```

#### Create First Box

Copy:

```text
Name your first Box
```

Supporting line:

```text
Start with a person, situation, topic, or event.
```

Placeholder examples:

- Mom
- Work
- Apartment

Display options:

- Photo
- Initial
- Name only

CTA:

```text
Create Box
```

#### First Composer

Header:

```text
Mom
```

Main placeholder:

```text
What happened?
```

Actions:

- Screenshot
- Receipt
- People
- Dictate

CTA:

```text
Save Note
```

### 7.3 Phase 2: Guided education

After the first Note is saved, the app teaches the system through compact surfaces.

Teach:

- Three Perspectives
- Perspective sub-headlines
- Long-press preview
- Unfiltered intensity menu
- Scope toggle
- People tagging
- Receipts
- OCR consent
- Search
- Free lock rules
- Panic hide
- Passcode
- Face ID

### 7.4 Onboarding progress indicator

Progress indicators are required in multi-step onboarding.

Use clear step names.

Example:

```text
Step 1 of 3: Create your first Box
Step 2 of 3: Add a Note
Step 3 of 3: See Perspective
```

Adult Eligibility is a required gate but is not part of the 3-step activation progress indicator. Do not show it as Step 1 of 4. It should feel like a short eligibility confirmation, not product education.

### 7.5 Onboarding copy

Core concept:

```text
NoteBox is where you keep the moments you do not want to lose.
```

Supporting line:

```text
Each Box holds notes, receipts, and context for a person or situation.
```

Perspective education:

```text
One note. Three ways to see it.
```

Aligned:

```text
Feel understood, right now.
```

Objective:

```text
Outside perspective.
```

Unfiltered:

```text
No holding back.
```

Lock explanation:

```text
Free includes 5 Boxes and 5 notes per Box.
After that, a Box locks for new notes, but you can still read everything.
```

Privacy explanation:

```text
Drafts autosave.
Backgrounding the app hides it.
Nothing gets deleted.
```

---

## 8. Home screen

### 8.1 Purpose

Home is the emotional command center, not a dashboard.

Home should feel calm, fast, and obvious.

Home must not show:

- Mood tracking
- Charts
- Analytics
- Streaks
- Prompts
- Gratitude suggestions
- Daily reminders
- Feed behavior

### 8.2 Locked Home layout

Top:

- Status bar
- NoteBox icon
- NoteBox wordmark
- Exact Home tagline: Private Boxes for real-life context.
- Notification/status circle

Middle:

- Connected search and category tray
- Recent Boxes carousel
- Carousel arrows
- Carousel dots

Below:

- Recent Notes from selected Box

Bottom:

- Slim dock with Categories, plus, Profile

### 8.3 Search tray

Placeholder:

```text
Search your Boxes
```

Search is always visible on Home.

The search tray includes:

- Search icon
- Search text
- Filter icon
- Category chips underneath:
  - All
  - Work
  - Personal
  - Family
  - Overflow

The search and chips are connected inside one tray.

### 8.4 Box carousel

Cards represent people, situations, topics, or events.

Carousel behavior:

- Ordered by recency
- Swipeable horizontally
- Arrow toggles left and right
- Search can jump instantly to a Box
- Cards are smaller than oversized hero cards so multiple cards can be partially visible
- Side cards sit behind the center card in a circular discarded-stack feel
- Switching carousel selection updates Recent Notes below

Card content:

- Box name
- Optional avatar/photo/initial/name-only visual
- Category chip
- Note count
- Ellipsis menu
- No paper clip
- No mood icon
- No metrics-heavy UI

### 8.5 Recent Notes section

Shows the most recent Notes for the selected Box.

Each row shows:

- Note preview
- Date
- Optional People chip
- Paper clip only if that specific Note has Receipts
- 3D-style icon tile
- Ellipsis menu

Example rows for demo and seed data:

```text
She said I never sent it, but the screenshot says otherwise.
Yesterday · Receipt attached

Meeting moved after I asked.
Mon · Deborah tagged
```

Avoid generic productivity copy such as quarterly project updates unless the user explicitly creates that content.

### 8.6 Quick add behavior

Home + Add Note defaults to the currently selected Box.

Composer opens with Box selector pill.

User can change Box before saving.

---

## 9. Complete screen-by-screen flow

### Screen 1: Splash

Purpose:

Brand trust and fast entry.

Components:

- Centered NoteBox logo icon
- NoteBox wordmark
- Warm textured ivory background
- Optional soft loading fade

Behavior:

- Authenticated, unlocked -> Home
- Authenticated, locked -> Privacy Return
- Unauthenticated -> Sign In

No scroll.

### Screen 2: Sign In

Purpose:

Private account access.

Components:

- NoteBox icon
- NoteBox wordmark
- Headline: "Keep the moments you do not want to lose."
- Subcopy: "Notes, receipts, people, and context, together."
- Sign in with Apple
- Privacy
- Terms

No scroll.

### Gate A: Adult Eligibility

Purpose:

Confirm adult eligibility before collecting private content. This is a required legal and product-safety gate, not a redesign of the 24 product screens.

Placement:

```text
After Sign In and before Create First Box
```

Components:

- Header: "Before we start"
- Copy: "NoteBox is designed for adults. It may contain private notes, receipts, emotionally sensitive context, and AI-generated perspectives."
- Checkbox: "I confirm I am 18 or older."
- CTA: Continue
- Footer: Terms and Privacy Policy

Rules:

- No DOB, ID, or selfie verification in v1 unless counsel requires it.
- If not confirmed, sign out and do not continue setup.
- Do not collect private content before this gate is complete.

No scroll.

### Screen 3: Create First Box

Purpose:

Create the first Box.

Components:

- Header: "Name your first Box"
- Subcopy: "Start with a person, situation, topic, or event."
- Box name input
- Examples: Mom, Work, Apartment
- Display style selector: Photo, Initial, Name only
- Optional Add photo
- CTA: Create Box

No scroll.

### Screen 4: First Note Composer

Purpose:

Save the first Note quickly.

Components:

- Back arrow
- Box selector pill
- Ellipsis menu
- Large text field
- Placeholder: "What happened?"
- Screenshot
- Receipt
- People
- Dictate
- Save Note
- Draft autosave reassurance if space allows

No scroll.

### Screen 5: Add Receipt Sheet

Purpose:

Attach Receipts.

Components:

- Add Screenshot
- Photo Library
- PDF / File
- Audio
- Link
- Cancel

Rules:

- Receipts are never auto-analyzed.
- OCR only runs after Extract text or Use in response.
- No video in v1.

### Screen 6: Tag People Sheet

Purpose:

Tag People quickly.

Components:

- Search people
- Recent people
- Add new person
- Selected people row
- Done

Rules:

- People, not Relationships.
- Quick add only, no long form.

### Screen 7: Save Success and Perspective Intro

Purpose:

Confirm saved record and introduce Perspectives.

Components:

- Confirmation icon
- "Saved to Mom"
- "Your note is kept with this Box."
- Aligned card
- Objective card
- Unfiltered card
- See Perspectives
- Back to Home

Rules:

- All three Perspectives generate after Save.
- No chat.

### Screen 8: Note Detail

Purpose:

Read the saved Note and access Receipts, People, Add more, and Perspectives.

Components:

- Back arrow
- Box chip
- Ellipsis
- Note preview card
- Last updated timestamp
- Tabs: Note, Receipts, Perspectives
- Rows: Add more, Receipts, People
- Receipt thumbnails if present
- Bottom actions

No scroll. Use modal or pagination for long content.

### Screen 9: Perspective Expanded Modal

Purpose:

Read one Perspective deeply.

Components:

- Back or close
- Perspective title
- Sub-headline
- Ellipsis
- Generated response
- Intensity pills for Unfiltered
- Say it differently
- Scope

Rules:

- No chat.
- No open prompt box.
- Regen rules enforced by entitlement.
- Unfiltered default is Bold.

### Screen 10: Home

Purpose:

Emotional command center.

Components:

- Locked Home components from Section 8.

Actions:

- Plus -> Composer
- Search -> Search
- Categories -> Categories
- Profile -> Profile
- Box card -> Box Detail
- Recent Note -> Note Detail
- View all Boxes -> View All Boxes
- View all Recent Notes -> View All Recent Notes

### Screen 11: Search

Purpose:

Retrieve, not browse.

Components:

- Search input
- Cancel
- Filter chips
- Top results
- View more results

Search scope:

- Note text
- Add more
- Box titles
- People names
- Extracted OCR text only

No scroll. Use pagination.

### Screen 12: Categories

Purpose:

Manage Box groups.

Components:

- Header: Categories
- All category
- Work category
- Personal category
- Family category
- Add Category

No scroll. More categories use horizontal paging.

### Screen 13: Category Detail

Purpose:

Show Boxes in one category.

Components:

- Header
- Search in category
- Horizontal Box rail
- Selected Box preview
- Recent Notes
- Add Box

No scroll.

### Screen 14: Box Detail

Purpose:

Show continuity inside one Box.

Components:

- Back
- Box visual
- Box name
- Category chip
- Ellipsis
- People chips
- Add Person
- Notes horizontal pager
- Add Note
- Search in this Box

Ellipsis menu:

- Search in this Box
- Sort
- Rename
- Archive
- Export Box, paid
- Delete, soft delete

No scroll.

### Screen 15: Add More Modal

Purpose:

Add context without changing the original Note.

Components:

- Header: Add more
- Subcopy: "This keeps the original note intact."
- Text field
- Add Receipt
- Tag People
- Save Add More

Rules:

- Timestamped.
- Does not overwrite original Note.
- Free users can add more.
- Does not count as a new Note.

### Screen 16: Locked Box Modal

Purpose:

Explain free limit without data hostage behavior.

Copy:

```text
This Box is locked for new notes.
You can still read everything.
```

CTA:

```text
Upgrade to keep adding
```

Secondary:

```text
Not now
```

Rules:

- No red styling.
- No warning haptic.
- No shame copy.
- Existing content remains readable.

### Screen 17: Upgrade

Purpose:

Ethical upgrade prompt.

Components:

- Header: Keep adding.
- Subcopy: "More Boxes, more Notes, full control."
- Unlimited Boxes
- Unlimited Notes
- More Receipts
- Patterns
- Export
- Editing
- Start Trial
- Not now
- Restore Purchases

Rules:

- StoreKit only inside iOS.
- Not now must be visible.
- Restore Purchases must be visible.

### Screen 18: Patterns Preview, paid

Purpose:

Show pattern clarity grounded in proof.

Components:

- Header: Patterns
- Card: "I noticed something."
- Proof snippets preview
- People pattern
- Recurring sequence
- Frequency note
- CTA: View this pattern

Rules:

- Paid-only full function.
- Free preview can be shown only as upgrade preview without exposing paid insights.
- Proof snippets required.
- No hallucinated evidence.

### Screen 19: Pattern Detail

Purpose:

Show one grounded insight.

Components:

- Insight title
- Plain-language explanation
- 2 to 3 proof snippets
- View related Notes
- View through Perspective

Each proof snippet includes:

- Date
- Box name
- Exact stored excerpt

Rules:

- No unsupported claims.
- No diagnoses as fact.
- No legal evidence framing.

### Screen 20: Profile

Purpose:

Plan, privacy, data, and app controls.

Components:

- Profile or membership header
- Plan status
- Upgrade pill if free
- Privacy and Security
- Data and Export
- Appearance
- Haptics
- Support
- Sign out

Data and Export must include:

- Export Note, paid/trial where applicable
- Export Box, paid/trial where applicable
- Download my data, paid/trial
- Copy Note text, free
- Delete Account

Account deletion rules:

- User must be able to initiate account deletion inside the app.
- Delete Account must be available from Profile -> Data and Export.
- Deletion must remove account data and associated user content unless legally required to retain specific billing, fraud, or compliance records.
- Delete Boxes, Notes, Add more blocks, Receipts, OCR text, AI outputs, search index rows, local drafts, and local lock credentials.
- Revoke active sessions.
- Clear SecureStore keys.
- Cancel local pending uploads and draft sync queues.
- If an Apple subscription is active, show Manage Subscription because deleting the app account does not necessarily cancel the Apple subscription.
- Use a clear confirmation flow, not dark patterns.

No scroll. More controls open sub-screens. If all Profile rows do not fit comfortably, group Appearance and Haptics under App Preferences or move lower-priority controls into sub-screens. Do not add a vertical Profile feed.

### Screen 21: Privacy and Security

Purpose:

Control privacy lock and app hiding.

Components:

- Face ID / Touch ID
- Passcode
- Auto-lock
- App switcher blur
- Panic close gesture

No scroll.

### Screen 22: Privacy Return

Purpose:

Show safe return after app was backgrounded or locked.

Components:

- Blurred app background
- NoteBox icon
- Tap to reveal
- Optional Face ID prompt

Rules:

- Panic hide is not panic delete.
- Nothing is deleted.
- Draft is not lost.
- Return to the exact prior screen.

### Screen 23: View All Boxes

Purpose:

See more Boxes without turning Home into a grid.

Components:

- Header: All Boxes
- Search
- Category filter
- Mini Box grid, max 6 visible
- Page dots
- Add Box

No scroll. Use pages.

### Screen 24: View All Recent Notes

Purpose:

See more recent Notes without turning Home into a feed.

Components:

- Header: Recent Notes
- Box filter
- 3 Note cards max
- Next page

No scroll. Use pages.

---

## 10. People system

### 10.1 People profiles

People profiles exist.

Fields:

- Name, required
- Avatar/photo, optional
- Background notes are deferred to v1.1 unless explicitly approved for v1. Do not add a half-built field silently.

### 10.2 People tagging

People can be tagged in:

- Boxes
- Notes
- Add more blocks inherit Note-level People tags in v1. Direct People tagging on individual Add more blocks is deferred unless explicitly approved.

A Person can appear across multiple Boxes.

Example:

Jessica can be:

- Her own Box
- Tagged in Work Notes
- Tagged in School Notes

### 10.3 Tagging rules

Tagging must be fast.

Do not turn tagging into a long form.

Support quick add during tagging.

Use:

```text
People
```

Do not use:

```text
Relationships
```

### 10.4 People search indexing

People names are included in global search and in-Box search.

---

## 11. Note composer and drafts

### 11.1 Purpose

The composer is sacred.

The user may be upset, angry, embarrassed, confused, or in a hurry.

The screen must reduce friction and avoid interruptions.

### 11.2 Composer layout

Top:

- Back arrow
- Box selector pill
- Ellipsis menu

Main:

- Large text input

Placeholder:

```text
What happened?
```

Actions:

- Screenshot
- Receipt
- People
- Dictate

Bottom:

- Save Note, solid primary CTA

### 11.3 Composer actions

Screenshot:

- Dedicated button
- Opens image picker filtered to images/screenshots
- Permission requested only on tap

Receipt:

- Opens receipt options
- Supports images, PDFs, audio, safe docs, links

People:

- Opens quick People picker
- Allows quick add

Dictate:

- Uses iOS native dictation or acceptable iOS dictation support in the approved React Native + Expo EAS build
- Dictation in progress must persist on background if technically feasible
- If native dictation persistence cannot be guaranteed, document limitation before v1 approval

### 11.4 Draft autosave

Non-negotiable.

Draft autosaves:

- Every 3 to 5 seconds while idle
- On background
- On app lock
- On crash recovery
- During dictation interruptions where technically feasible

Draft persists until:

- User saves it
- User explicitly discards it

Draft must not be lost due to:

- Backgrounding
- Panic hide
- App crash
- Lock screen
- Dictation interruption
- Network failure

### 11.5 Typing is sacred

Do not show:

- Live moderation popups
- Warning banners
- AI suggestions while typing
- Prompt suggestions
- Emotion labels
- Therapy nudges

Safety handling happens after response generation, not while typing.

---

## 12. Note Detail, Add more, and editing

### 12.1 Note Detail structure

Note Detail includes:

- Note body, latest version
- Last updated timestamp
- Add more blocks with timestamps
- Receipts strip
- People tags
- Perspective section

### 12.2 Note ellipsis menu

Menu items:

- Edit, paid and trial only
- Add more, all plans
- Version History, paid and trial
- Revert, paid and trial
- Export Note, paid and trial
- Copy Text, all plans
- Delete, soft delete

### 12.3 Add more

Add more is a timestamped block attached to a Note.

It does not overwrite original Note text.

Free users can add more.

Reason:

Add more preserves the record and increases continuity without allowing post-trial editing.

### 12.4 Editing

Trial:

- Can edit Notes
- Can add more
- Can revert
- Version history stored

Free post-trial:

- Cannot edit original Note text
- Can add more
- Can read all content

Paid:

- Can edit Notes
- Version history stored
- Can revert
- Two-step save confirmation required

### 12.5 Two-step save confirmation

For paid and trial editing:

```text
User edits -> taps Save -> modal: Save changes?
```

Options:

- Save
- Cancel

Purpose:

Prevent accidental overwrites.

### 12.6 Version history and revert

Version history:

- Store all versions
- Show last 3 versions in primary UI
- Full list can live in secondary screen

Revert behavior:

- View previous
- Revert to previous

Keep UI minimal.

---

## 13. Perspective system

### 13.1 Core rule

No chat thread in v1.

Perspectives are single-shot responses attached to a saved Note.

User writes Note -> saves Note -> all three Perspectives generate.

The user's words are primary.

AI is controlled perspective, not conversation.

### 13.2 Three Perspectives

After saving a Note, NoteBox automatically generates all three:

- Aligned
- Objective
- Unfiltered

Free users can view all three.

Paid and trial users get more control and variation.

### 13.3 Perspective UI copy

Aligned:

```text
Feel understood, right now.
```

Objective:

```text
Outside perspective.
```

Unfiltered:

```text
No holding back.
```

### 13.4 Display behavior

All three cards are visible together at selection time.

Each card displays:

- Title
- Sub-headline
- Generated response or preview

Tapping a card may:

- Expand it
- Focus it
- Open Perspective Expanded modal

Tapping does not trigger first generation.

First generation happens automatically after Save.

### 13.5 Why cards stay visible together

The contrast is the feature.

Do not collapse the three Perspectives into:

- A segmented control only
- Hidden tabs only
- Swipe-only cards
- One visible state at a time

Users need to see that this is not just AI output.

It is structured perspective.

### 13.6 Long-press preview

Long-press any Perspective card to show a sample tone preview.

Rules:

- Shows once per card per user
- Educational only
- Not a separate AI call
- No haptic on tooltip reveal
- 2 to 3 lines max
- Tooltip must match actual behavior

### 13.7 Aligned behavior

Aligned means emotional alliance.

It should:

- Validate
- Support
- Reinforce
- Help the user feel less alone
- Avoid fluff
- Avoid generic comfort
- Avoid therapy language

### 13.8 Objective behavior

Objective means outside perspective.

It should:

- Give a clean read
- Offer a neutral lens
- Point out alternate interpretations
- Provide a good-faith devil's advocate angle when appropriate
- Include one question when useful
- Avoid automatically siding with the user
- Avoid coldness

### 13.9 Unfiltered behavior

Unfiltered means no holding back.

It should:

- Call out behavior, pattern, excuse, dynamic, or double standard
- Feel direct
- Feel like the app is done giving unnecessary benefit of the doubt
- Help the user stop excusing the thing
- Use controlled bite
- Stay grounded in the Note

Unfiltered must not:

- Encourage harassment
- Encourage retaliation
- Encourage stalking
- Encourage doxxing
- Encourage violence
- Use slurs
- Dehumanize people
- Diagnose someone as a narcissist, sociopath, or abuser as fact
- Become cruelty for entertainment

Important:

Unfiltered is sharp. It is not a roast machine.

### 13.10 Unfiltered intensity

Intensity levels:

- Mild
- Bold
- Savage

Default:

```text
Bold
```

Rules:

- No global default setting
- No per-Box default setting
- No "remember my tone" setting
- Every new generation defaults to Bold unless user explicitly changes intensity in that Note/session
- If user returns to an existing response, show stored response and intensity label if needed

Entitlements:

Free:

- Sees intensity control
- Default Bold only
- Mild and Savage are locked
- Selecting locked levels opens upgrade prompt

Trial:

- Can select Mild, Bold, Savage
- Unlimited regen

Paid:

- Can select Mild, Bold, Savage
- Regen limits apply

Placement:

- In Perspective Expanded modal for Unfiltered
- Or behind Unfiltered ellipsis
- Do not show full controls inline by default

### 13.11 Context scope

Default scope:

```text
This note only
```

Scope options:

- This note only, default
- Include this Box history
- Include tagged people across Boxes, paid only

Placement:

- Perspective Expanded modal or Perspective settings menu
- Not front-and-center before first Note save

V1 safest implementation:

- First generation uses This note only
- User can change scope during regen
- Regen with new scope saves a new AI response version for that state

Scope enforcement:

- Always cap context
- Include Add more blocks
- Include receipts only if user explicitly selects Use in response
- Never auto-analyze receipts

### 13.12 Regeneration

Free:

- 1 regen token per Note total
- Can apply to one selected state once

Paid:

- 5 regen per Note per state

Trial:

- Unlimited regen

UI:

```text
Say it differently
```

Optional chips:

- More specific
- More direct
- Softer
- Sharper

Optional input:

```text
Add missing detail
```

If used, missing detail is saved as Add more and used in regen.

Regen quality rules:

- Must materially change angle
- Must not merely paraphrase
- Must not repeat key phrases
- Must keep chosen state and intensity
- Must respect scope

### 13.13 AI implementation

Recommended:

One structured model call returns all three states.

Store outputs separately per state.

Store:

- Note ID
- State
- Response text
- Intensity, for Unfiltered
- Scope
- Created timestamp
- Regen version number if applicable
- Safety flags if applicable

Token caps enforced server-side.

---

## 14. Receipts, screenshots, OCR

### 14.1 Receipts definition

Receipts are attachments connected to a Note.

Supported:

- Images
- Screenshots
- PDFs
- Audio files
- Safe docs
- Links with rich preview

No video in v1.

No screen recordings in v1.

### 14.2 Attachment limits

Free:

- 3 receipts per Note
- 250MB storage

Trial:

- 10 receipts per Note
- 5GB storage

Paid:

- 10 receipts per Note
- 5GB storage

Storage caps are server-configurable constants.

### 14.3 Receipt display

In Note rows:

- Show paper clip icon only if that Note has receipts

In Note Detail:

- Receipts section
- Paper clip icon in section header
- Thumbnails or file list below

### 14.4 Dedicated Screenshot

Composer has a dedicated Screenshot button.

Behavior:

- Opens image picker filtered to images/screenshots
- Treats screenshot like any other image receipt
- Permission requested only when tapped

### 14.5 Add Receipt

Composer also has Receipt action.

Supported inputs:

- Image
- PDF
- Audio
- Safe doc
- Link

### 14.6 Audio receipt consent

Audio receipts are allowed in v1 only with explicit user action.

Rules:

- Audio recording requires a clear tap to start.
- Show an obvious recording state.
- Show duration timer.
- Show stop and cancel controls.
- Never record secretly.
- Never record in background.
- Never auto-transcribe audio in v1 unless user taps Transcribe, Extract text, or Use in response.
- If audio is uploaded as a file rather than recorded in-app, treat it as a Receipt and do not analyze it automatically.
- Audio files count toward Receipt limits and storage quotas.

### 14.7 OCR consent

Non-negotiable:

Receipts are never auto-analyzed.

OCR runs only when user taps:

- Extract text
- Use in response

Extracted text is stored so OCR is not rerun unnecessarily.

User must be able to delete extracted text without deleting the receipt.

### 14.8 Use in response

A receipt is included in AI only if user explicitly enables Use in response.

Default:

```text
Not included.
```

### 14.9 Sharing and screenshots

Do not block iOS screenshots in v1.

Users may screenshot to share.

---

## 15. Search and filtering

### 15.1 Global search

Global search is required.

Location:

- Home search tray
- Search screen

Placeholder:

```text
Search your Boxes
```

Search scope:

- Note text, latest version
- Add more blocks
- Box titles
- People names
- Extracted OCR text, only if extracted

Do not search:

- Unextracted receipts
- AI hallucinated data
- Pattern summaries as evidence
- Deleted content unless explicitly restored or in admin tools

### 15.2 Search results UI

Results grouped by Box.

Each result shows:

- Box name
- Snippet
- Date
- Highlighted keyword
- People tag if relevant
- Receipt indicator if that Note has Receipts

Tap result opens Note at match location.

### 15.3 Keyword highlighting

When user searches a word, example "yelling":

- Highlight all instances in snippets
- Highlight all instances inside Note
- Auto-open or focus first match in the Note view
- Provide next-match navigation if multiple matches exist

Highlight style:

- Soft rose gold underline or subtle highlight
- Not neon block
- Must stay premium and readable

### 15.4 In-Box search

Box Detail includes:

```text
Search in this Box
```

Same behavior as global search, scoped to one Box.

### 15.5 Date sorting and filtering

Box-level tools:

- Newest to Oldest
- Oldest to Newest
- Custom Date Range

Date tools apply to:

- Box Note list
- In-Box search

Global search v1:

- Keyword-based
- No global dashboard filter UI

Do not turn Home into analytics.

### 15.6 Search implementation

Preferred:

- Server-side indexed search
- Paginated results
- Debounced query
- Cached recent results if possible
- Highlight snippets generated safely from stored text

---

## 16. Limits, locking, and retention mechanics

### 16.1 Free plan caps

Free users get:

- 5 active Boxes
- 5 Notes per Box
- 3 receipts per Note
- 250MB storage
- 1 regen token per Note total
- View all three Perspectives
- Add more allowed
- Copy text export only
- No full Patterns access
- No editing after trial

### 16.2 Fourth Note warning

After the 4th Note is saved in a Box, show a heads-up once.

Tone:

Calm, not punitive.

Example:

```text
One more note can be added to this Box on the free plan.
You will still be able to read everything.
```

### 16.3 Fifth Note lock

After the 5th Note is saved:

Box becomes locked for writing.

User can still:

- Open Box
- Read all Notes
- Search within it
- View receipts
- View Perspectives
- Add more to existing Notes, because Add more preserves continuity and does not create a new Note

User cannot:

- Add a new Note to that Box

Upgrade CTA shown when attempting to add.

### 16.4 Archive rule for free

To create a 6th active Box, free user must archive one.

Archived Boxes:

- Remain readable
- Can be restored only if active Box count is below cap
- Should remain searchable if backend supports archived search scope
- If archived search is excluded in v1, UI must make that clear

### 16.5 Paid plan

Paid users have:

- No active Box cap
- No Notes per Box cap
- Paid receipt limits and storage caps as defined
- Patterns
- Editing
- Exports

---

## 17. Patterns

### 17.1 Availability

Patterns are paid-only.

In v2, Patterns are not a visible default free-user bottom tab.

Access options:

- Paid user Profile entry
- Paid-only surface
- Upgrade preview
- Optional future paid nav state

Free users may see a limited Patterns preview only if it does not reveal paid insights.

### 17.2 Philosophy

Patterns are clarity, not courtroom evidence.

Patterns should feel like:

```text
I noticed something.
```

Not:

```text
Pattern detected. Evidence compiled.
```

### 17.3 Pattern sources

Patterns may use:

- Notes, latest versions
- Add more blocks
- People tags
- Box metadata
- Extracted OCR text only if user extracted it

Patterns may not use:

- Unextracted receipts
- Unsupported AI inference
- Hallucinated examples
- Claims without stored proof

### 17.4 Patterns tab or surface content

Patterns may include:

- People patterns
- Recurring sequences
- Frequency notes
- Cross-Box relationships through People tagging

### 17.5 Proactive pattern surfacing

Rare and high confidence only.

Card copy:

```text
I noticed something.
```

Buttons:

- Show me
- Not now

Not now snoozes for 7 days.

### 17.6 Proof snippets

Pattern insights must include 2 to 3 proof snippets.

Each snippet must include:

- Date
- Box name
- Exact stored quote or excerpt

If there is not enough evidence, do not surface the pattern.

### 17.7 Tone

Measured, editorial, not comedic.

After seeing a core insight, user may optionally view it through a Perspective, but Patterns themselves must remain grounded.

---

## 18. Safety, resources, and trust

### 18.1 Typing remains uninterrupted

No live safety popups while typing.

No warning banners in composer.

No content moderation overlays during drafting.

### 18.2 Response-time safety handling

Safety handling occurs after save and during AI response generation.

### 18.3 Self-harm language

If self-harm language appears:

AI tone:

- Grounding
- No jokes
- No roast tone
- No shame

Show optional resources card below response.

Buttons:

- View resources
- Ask me later
- Don't ask for 12 hours

Resources permanently available in Profile or Support.

Use national hotline numbers in v1.

Launch geography rule:

- If v1 ships only in the United States, national US resources are acceptable.
- If v1 ships outside the United States, locale-appropriate resources must be implemented before launch in those regions.
- Do not show a US-only crisis resource card as if it is universal.

Device locale support can be added later only if App Store availability is limited accordingly.

### 18.4 Violence toward others

If violence toward others appears:

AI must:

- Not endorse
- Not escalate
- Match emotion without encouraging action
- Redirect away from harm
- Avoid tactical advice

No resources card by default unless self-harm or crisis context requires it.

### 18.5 Unfiltered safety

Unfiltered can be direct and sharp.

Unfiltered cannot:

- Encourage revenge
- Encourage stalking
- Encourage harassment
- Encourage doxxing
- Encourage violence
- Dehumanize people
- Provide abuse tactics
- Diagnose people as fact
- Become a roast machine for cruelty

---

## 19. Privacy, panic hide, security

### 19.1 Panic hide

Non-negotiable.

When user locks phone or backgrounds app:

- App switcher shows blur
- Draft autosaves
- Nothing is deleted

On return:

- If privacy lock enabled, app opens to Privacy Return
- If not enabled, app shows blurred cover requiring tap to reveal
- User returns to exactly where they were

Panic hide is not panic delete.

Nothing is deleted.

### 19.2 Security settings

Profile -> Privacy and Security

Options:

- Face ID / Touch ID
- 4-digit PIN
- 6-digit PIN
- Custom numeric
- Alphanumeric passcode
- Auto-lock timer
- App switcher blur
- Panic close gesture is optional and not a v1 ship blocker unless explicitly approved; app switcher blur and privacy return are mandatory
- Hide sensitive notification previews, for future notifications only

### 19.3 Password and passcode rules

Passcode options:

- 4-digit PIN
- 6-digit PIN
- Custom numeric, 8 to 12 digits
- Alphanumeric, 8 to 32 characters

Passcode validation is local.

Passcode is never transmitted.

Store securely using iOS secure storage.

### 19.4 Notifications

No push notifications in v1.

The Home bell/status circle must not introduce:

- Daily reminders
- Streak nudges
- Emotional prompts
- Re-engagement notifications

If notifications are added later:

- Hide content previews by default or provide explicit Privacy and Security control
- No emotionally sensitive content in notification preview

### 19.5 Encryption baseline

Required:

- TLS in transit
- Encryption at rest using cloud provider managed keys
- Local drafts stored encrypted
- Secure storage for auth and lock credentials

No custom end-to-end encryption in v1.

### 19.6 Model training, provider data retention, and privacy

Track actions, not Note text.

NoteBox does not use private Note content for internal analytics or internal model training.

If using an AI provider API:

- Do not opt in to provider model training with private user content.
- Do not promise zero retention unless the vendor contract supports it.
- Privacy copy must distinguish NoteBox's internal policy from the AI provider's abuse-monitoring or retention policy.
- If a zero-data-retention contract is obtained later, update the privacy policy and handoff explicitly.
- Log AI request metadata for reliability and billing, not raw private Note text, unless required for safety debugging and covered by the privacy policy.

Any future "help improve NoteBox" must be opt-in and separate.

### 19.7 No social distribution or public UGC in v1

NoteBox stores private user content. It does not distribute user content to other users.

Do not implement in v1:

- Social feed
- Public profiles
- User-to-user messaging
- Anonymous chat
- Public sharing
- Community posts
- Template marketplace
- Public comments
- Public reactions

Allowed:

- User may export their own content.
- User may use iOS screenshots.
- User may copy their own Note text.

Reason:

The product is a private record, not a social product. Adding public UGC would create moderation, reporting, blocking, support, trust, and App Review requirements that do not belong in v1.

### 19.8 SecureStore and local secret handling

SecureStore is for small secrets only.

Use SecureStore for:

- Auth tokens
- Refresh tokens if used
- Local privacy-lock credentials or references
- Small cryptographic keys if the implementation requires them

Do not use SecureStore for:

- Notes
- Receipts
- AI outputs
- OCR text
- Draft bodies
- Search indexes

Rules:

- Draft bodies require a real encrypted local storage strategy.
- On logout, clear SecureStore keys.
- On Delete Account, clear SecureStore keys.
- On reinstall, handle stale Keychain tokens safely.
- Never reopen private content from a stale token without validating the session server-side.

---

## 20. Export and data portability

### 20.1 Free export

Free:

- Copy Note text only

### 20.2 Trial and paid export

Trial and paid:

- Export Note as PDF
- Export Box as PDF
- Download my data as ZIP

### 20.3 Note PDF export

Includes:

- Latest Note text
- Add more blocks with timestamps
- Receipts listed with filenames and types
- Embedded images when small
- Larger files listed
- AI Perspectives included only via toggle, default off

### 20.4 Box PDF export

Includes:

- Cover page with Box name and date range
- Notes in chronological order
- Add more inline
- Receipts per Note
- AI Perspectives toggle, default off

### 20.5 Download my data

ZIP contains JSON for:

- Boxes
- Notes
- Versions
- Add more blocks
- Receipt metadata
- AI outputs optional

Delivery:

- In-app link when ready
- Email optional only if email storage exists later

### 20.6 Export jobs

Exports should be async.

User requests export -> backend job starts -> app polls status -> temporary link delivered.

Do not block UI with synchronous export generation.

### 20.7 Legal privacy data access requests

Product export features can remain entitlement-gated as defined above.

Legal privacy data access requests must not be blocked by subscription status. If a user has a legal right to access personal data under applicable privacy law, NoteBox must honor that request through the privacy/support process even if the in-app premium export feature is not available to that plan.

Rules:

- Do not market paid export as the only way to access legally required personal data.
- Privacy Policy and Support must explain how users can make privacy requests.
- Do not treat legal privacy requests as a premium feature.
- Keep the product distinction clear: paid export is a convenience feature; legal data access is a compliance process.

---

## 21. Account deletion and data deletion

### 21.1 In-app account deletion

Apps that create accounts must allow users to initiate account deletion inside the app. NoteBox must implement this before App Store submission.

Location:

```text
Profile -> Data and Export -> Delete Account
```

User flow:

1. User taps Delete Account.
2. App explains what will be deleted.
3. App explains that Apple subscription management is separate if the user has an active subscription.
4. User confirms.
5. Server starts deletion job.
6. App signs user out.
7. Local secrets, drafts, queues, and cached content are cleared.

### 21.2 Data deletion scope

Delete or irreversibly detach from the user:

- User profile
- Boxes
- Categories
- People
- Notes
- Note versions
- Add more blocks
- Receipts and receipt metadata
- OCR text
- AI responses
- Regen usage linked to private content
- Pattern insights
- Search index rows
- Export jobs and temporary links
- Local drafts
- Local caches
- SecureStore keys

Retain only what is legally required for billing, fraud prevention, tax, chargeback, security, or compliance. Retained records must not include private Note body text unless legally required.

### 21.3 Subscription handling during account deletion

Account deletion does not silently cancel an App Store subscription.

If a user has an active subscription, show:

```text
Your NoteBox account can be deleted here. Your Apple subscription is managed separately by Apple.
```

Provide:

- Manage Subscription
- Continue deleting account
- Cancel

### 21.4 Account deletion QA blockers

A build fails QA if:

- Delete Account is not available in-app.
- Delete Account is hidden behind email-only support.
- Delete Account fails to clear local drafts.
- Delete Account fails to clear SecureStore keys.
- Delete Account leaves private Notes searchable.
- Delete Account leaves AI outputs or OCR text accessible.
- Delete Account claims to cancel Apple subscriptions when it does not.

---

## 22. Billing, trial, entitlements

### 22.1 iOS billing

iOS app uses StoreKit subscriptions only.

Required:

- Restore Purchases visible
- Manage Subscription link visible
- Privacy Policy URL
- Terms URL
- Support URL
- Backend receipt verification
- Backend entitlement assignment

Do not use Stripe checkout inside iOS.

### 22.2 Stripe

Stripe is not required for iOS v1.

Build entitlement abstraction so future web Stripe plans can map to the same entitlements.

Stripe webhooks may be added later for web-only flows.

### 22.3 Trial

Trial:

- 14 days
- Full access
- Unlimited regen
- Editing enabled
- Version history enabled
- Revert enabled
- Patterns enabled
- Export enabled
- Full Unfiltered intensity selection

### 22.4 Pricing

Target:

```text
$7 to $8 per month, configurable.
```

Final price can be changed without restructuring entitlements.

### 22.5 Entitlement table

Free:

- 5 active Boxes
- 5 Notes per Box
- Box locked for writing after 5th Note
- Existing content readable forever
- 3 receipts per Note
- 250MB storage
- View all 3 Perspectives
- Unfiltered default Bold only
- 1 regen token per Note total
- Cannot edit Note text post-trial
- Can add more
- Export: copy text only
- No full Patterns access

Trial:

- Full access
- No Box cap
- No Notes cap
- 10 receipts per Note
- 5GB storage
- Unlimited regen
- Can edit
- Version history
- Revert
- All Unfiltered intensities
- Scope controls
- Patterns
- PDF export
- Data ZIP

Paid:

- No Box cap
- No Notes cap
- 10 receipts per Note
- 5GB storage
- 5 regen per Note per state
- Can edit
- Version history
- Revert
- All Unfiltered intensities
- Scope controls
- Patterns
- PDF export
- Data ZIP

### 22.6 Server enforcement

All entitlements are enforced server-side.

Client enforcement alone is not acceptable.

Server must enforce before:

- Creating Box
- Creating Note
- Uploading receipt
- Triggering OCR
- Running AI generation
- Running regen
- Exporting PDF or ZIP
- Accessing Patterns

---

## 23. Backend and APIs

### 23.1 Backend requirement

Backend is mandatory for v1.

No local-only prototype is acceptable for shipping.

### 23.2 Core entities

Suggested schema entities:

- User
- UserComplianceState, including age_attested, age_attested_at, age_attestation_version
- AccountDeletionJob
- Subscription
- Entitlement
- Box
- Category
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

### 23.3 Core APIs

Auth and account:

- Sign in with Apple
- Sign out
- Record adult eligibility attestation
- Fetch eligibility status
- Block setup when eligibility is incomplete
- Request account deletion
- Poll account deletion status
- Revoke active sessions
- Delete or anonymize minimal auth stub if user declines eligibility before setup

Boxes:

- Create
- Read
- Update
- Archive
- Restore
- Soft delete
- List by recency

Categories:

- Create
- Read
- Update
- Delete
- Assign Box
- List with Box counts

People:

- Create
- Update
- List
- Tag associations
- Quick add

Notes:

- Create
- Read
- Update, paid/trial only
- Soft delete
- Restore
- List by Box
- List recent by Box

Note versions:

- Create version on edit
- List versions
- Revert

Add more:

- Create
- List

Receipts:

- Create signed upload URL
- Confirm upload
- List
- Delete receipt
- Check quota before upload

OCR:

- Trigger extraction
- Store extracted text
- Delete extracted text
- Use extracted text in search only after extraction

AI generation:

- Generate three Perspectives
- Store structured output
- Respect scope
- Respect intensity
- Enforce token budgets

Regen:

- Regenerate selected state
- Enforce limits
- Track usage

Patterns:

- Generate
- List
- Proactive insight
- Dismiss
- Snooze

Search:

- Query
- Paginated results
- Highlight snippets
- Scope global, category, or Box

Export:

- Request Note PDF
- Request Box PDF
- Request data ZIP
- Poll status
- Retrieve temporary link

Privacy requests:

- Submit privacy data access request
- Submit privacy deletion support request, separate from in-app automated deletion
- Track privacy request status for support/admin workflow

Profile and settings:

- Security preferences
- Haptics preferences
- Privacy lock settings
- Appearance preferences if shipped
- Data and Export preferences
- Account deletion request state

Admin:

- User plan
- Storage used
- Usage counts
- Errors
- Receipt validation status

### 23.4 Offline and sync

Required:

- Idempotent Note creation keys
- Local queue for pending saves
- Sync on reconnect
- Draft survives offline
- Receipt upload can retry
- Search may show cached local results if possible

Conflict handling:

- Last updated wins for displayed Note
- Preserve versions
- Never silently discard user text

### 23.5 Observability

Required:

- Crash logs
- Backend tracing
- Error monitoring
- Receipt validation errors
- Export job errors
- AI generation failures
- OCR failures
- Storage quota errors

---

## 24. AI prompting requirements

### 24.1 Structured output

One call should return:

- Aligned
- Objective
- Unfiltered

Each state stored separately.

### 24.2 State behavior

Aligned:

- Validate
- Reinforce
- Support
- No fluff

Objective:

- Neutral clarity
- Outside perspective
- Alternate lens
- One question when appropriate

Unfiltered:

- Sharp reframing
- Controlled bite
- Call out behavior or dynamic
- No harmful escalation

### 24.3 Context rules

Default:

- This note only

Optional:

- Include Box history
- Include tagged people across Boxes, paid only

Always cap context.

Receipts only included if user enabled Use in response.

OCR text only included if user extracted it.

### 24.4 Safety constraints

AI must not:

- Joke about self-harm
- Encourage violence
- Encourage harassment
- Encourage doxxing
- Diagnose people as fact
- Invent pattern evidence
- Claim something happened that is not in stored user text
- Treat Patterns as legal evidence

### 24.5 Pattern evidence

Patterns must quote only stored user text.

If proof is insufficient, do not surface the insight.

---

## 25. Haptics, animation, performance

### 25.1 Haptic taxonomy

Navigation Tick:

- Duration: 50 to 80 ms
- Intensity: Light, 10 to 30 percent
- Use: tab switches, carousel snap, back navigation, search result open

Micro-Interaction:

- Duration: 100 to 150 ms
- Intensity: Medium, 40 to 60 percent
- Use: button taps, toggles, menus, Perspective card selection, sort selection

Success Reward:

- Duration: 400 ms
- Intensity: Strong, 70 to 100 percent
- Use: Save Note success, first Note saved, export complete, purchase success

Milestone Signal:

- Duration: 500 to 800 ms
- Use: onboarding complete, trial started, upgrade complete

Warning:

- Duration: 2 pulses of 150 ms
- Use: form error, failed upload, failed payment, destructive confirmation

Critical Alarm:

- Duration: greater than 1000 ms
- Use only for critical security alerts or session expiry

### 25.2 Haptic rules

- No haptics while actively typing
- No haptic on long-press Perspective preview
- Same haptic intensity for Upgrade and Not now
- No dark haptics
- Haptics toggle required
- Strong intensity reserved for success and critical only
- Do not punish privacy-protective choices with alarming haptics

### 25.3 Haptics settings

Profile -> Haptics includes:

- Off
- Light
- Standard

Default:

```text
Standard
```

Respect setting unconditionally.

### 25.4 Audio

Audio off by default everywhere.

Audio is opt-in only.

Audio may be used only on milestone events if enabled.

If audio, haptic, and visual feedback are layered, they must fire within the synchrony window.

### 25.5 Multisensory sync

Maximum delay for a unified fingertip event:

```text
55 ms
```

Use sync for:

- Save Note success
- Onboarding completion
- Purchase success

Do not layer modalities when sync cannot be guaranteed.

### 25.6 Animation timings

Button press feedback:

```text
80 to 150 ms
```

CTA attention pulse:

```text
200 to 300 ms, use sparingly
```

Screen transition:

```text
200 to 350 ms
```

Success celebration:

```text
400 to 600 ms
```

Routine interface response animation hard cap:

```text
Under 300 ms
```

### 25.7 Performance targets

First visual credibility impression happens immediately.

Targets:

- First render skeleton: as close to instant as possible
- Home load: target under 2 seconds
- Hard mobile threshold: under or equal to 3 seconds
- Every extra second hurts conversion and trust
- Prioritize speed and crash reduction before visual polish

Priority order:

1. Load speed
2. Crash rate
3. Data integrity
4. Security and privacy
5. Visual polish
6. Haptics refinement

---

## 26. Accessibility

Accessibility is a ship requirement.

Must support:

- Dynamic Type
- High contrast
- Minimum 44 x 44 tap targets
- Screen reader labels
- Reduced motion support
- Sufficient color contrast
- No metallic text for body copy

Screen reader labels required for:

- Paper clip icon
- Lock icon
- Ellipsis menus
- Perspective cards
- Receipt thumbnails
- Search highlights
- Add Note button
- Add Screenshot button
- Add Receipt button
- Privacy lock controls

Perspective cards must read:

```text
Aligned. Feel understood, right now.
Objective. Outside perspective.
Unfiltered. No holding back.
```

Receipts must have accessible filenames or user-editable labels.

---

## 27. Analytics

Track actions only.

Never track private Note text.

### 27.1 Account events

- account_created
- age_eligibility_confirmed
- age_eligibility_declined
- account_deletion_requested
- account_deleted
- trial_started
- trial_ended
- subscription_started
- subscription_canceled
- payment_failed

### 27.2 Box events

- box_created
- box_opened
- box_archived
- box_restored
- box_reached_4
- box_locked_for_writing
- locked_add_note_attempted
- upgrade_cta_clicked

### 27.3 Category events

- category_created
- category_opened
- category_renamed
- category_deleted
- box_assigned_to_category

### 27.4 People events

- person_created
- person_tagged_in_note
- person_tagged_in_box

### 27.5 Note events

- note_created
- note_opened
- note_edited
- note_reverted
- add_more_added
- note_deleted_soft
- note_restored

### 27.6 Receipt events

- receipt_added
- receipt_use_in_response_toggled
- ocr_extract_triggered
- ocr_text_deleted
- storage_limit_hit

### 27.7 AI events

- responses_generated
- state_viewed
- intensity_selected
- scope_selected
- regen_clicked
- regen_completed
- regen_limit_hit

### 27.8 Search events

- search_performed
- search_result_opened

### 27.9 Patterns events

- patterns_surface_opened
- proactive_pattern_shown
- proactive_pattern_opened
- proactive_pattern_dismissed
- pattern_pull_run

### 27.10 Safety resources events

- resources_card_shown
- resources_opened
- resources_snoozed_12h

### 27.11 Privacy request events

- privacy_access_request_started
- privacy_access_request_submitted
- account_deletion_started
- account_deletion_completed
- account_deletion_failed

---

## 28. App Store, ASO, and marketing site

### 28.1 App Store category and age-rating posture

Category:

```text
Lifestyle
```

Not Health and Fitness.

Not Safety.

Reason:

Avoid therapy-coded wellness category and crisis-documentation positioning.

Age-rating posture:

- NoteBox is designed for adults.
- Use App Store Connect's age-rating questionnaire honestly.
- Do not self-label with a final App Store age rating inside the product unless App Store Connect confirms it.
- Implement in-app self-attestation of 18+ before collecting private content.
- Do not use invasive ID verification in v1.

### 28.2 App Store compliance

Required:

- Privacy Policy URL
- Terms URL
- Support URL
- Restore Purchases
- Manage Subscription
- Sign in with Apple
- StoreKit subscription flow
- Clear subscription terms
- No Stripe checkout in iOS app

### 28.3 App Store screenshot sequence

Screenshots should demonstrate:

1. Home with Box carousel
2. Create Note
3. Three Perspectives
4. Receipts
5. Search
6. Locked for writing, readable forever
7. Privacy blur or panic hide
8. Patterns, paid

### 28.4 App Store messaging

Avoid:

- Therapy
- Healing
- Mental health
- Gratitude
- Mood tracker
- AI companion
- Coach
- Best friend
- Journaling prompts

Use:

- Private record
- Pattern clarity
- Keep everything together
- Notes and receipts
- Perspective is optional
- Record is primary

Canonical App Store subtitle candidate:

```text
Private notes, receipts, and context.
```

Canonical Home tagline:

```text
Private Boxes for real-life context.
```

Supporting onboarding line:

```text
Keep private notes where they belong.
```

Longer explanation:

```text
Create private Boxes for people, situations, topics, or events, then keep the notes, receipts, people, and context together.
```

Legacy positioning line, marketing only:

```text
Not your therapist. Not your cheerleader. Your private record.
```

### 28.5 Marketing site

Marketing site is required.

Recommended stack:

- Next.js

Required pages:

- Home
- Pricing
- Privacy
- Terms
- Support
- Blog

Marketing site tone:

- Editorial
- Private
- Smart
- Controlled
- Anti-therapy without being hostile
- Clear about ownership and privacy

Marketing site must avoid:

- Therapy claims
- Healing claims
- Mental health claims
- Abuse evidence positioning
- Crisis claims
- Mood tracking language

### 28.6 GTM strategy

Launch approach:

- iOS-first
- Product-led
- No bloated waitlist requirement
- Organic PR and editorial positioning
- ASO strong from launch
- Product Hunt optional
- Community of women who get it, but do not make app social

Positioning:

NoteBox is creating a category around emotional continuity, controlled perspective, and private record keeping.

---

## 29. Ethical UX and anti-pattern rules

### 29.1 Paywall ethics

Do not:

- Hide Not now
- Use guilt copy
- Use fake scarcity
- Use alarming haptics on cancellation
- Make cancellation harder than signup
- Lock access to past user content
- Shame free users
- Surprise users with lock mechanics

Do:

- Explain limits before lock
- Show warning at 4th Note
- Keep locked Boxes readable
- Show Restore Purchases
- Show Manage Subscription
- Show Cancel anytime where appropriate

### 29.2 Guest checkout interpretation

Do not implement guest private Notes in v1.

Instead:

- Do not force payment before value
- Keep Sign in with Apple fast
- Do not ask for credit card before aha
- Introduce trial or upgrade after value is shown

### 29.3 No dark haptics

Do not pair warning haptics with:

- Not now
- Decline upgrade
- Turn off haptics
- Turn on privacy controls
- Disable analytics
- Cancel subscription management flow

Upgrade and Not now receive the same neutral micro-interaction haptic.

---

## 30. Known v2/v3.4 flow issues and resolutions

### Issue 1: Bottom dock changed from older spec

Older spec said bottom tabs were Home, Patterns, Settings. The new design uses Categories, plus, Profile.

Resolution:

- v2 locks Categories, plus, Profile.
- Profile absorbs Settings.
- Patterns are paid-only, not a default free tab.
- Paid Patterns access can live in Profile, a paid surface, or upgrade preview.

### Issue 2: Bell/status icon conflicts with no notifications in v1

The Home mockup includes a bell-like icon.

Resolution:

- In v1, this is an in-app status or account notice button only.
- It must not enable push notifications, daily reminders, streak nudges, or prompt notifications.
- If this creates confusion in testing, change the icon to a shield, lock, or status dot.

### Issue 3: Screenshot action appears twice

The Composer has Screenshot and Receipt. The Receipt sheet also includes Add Screenshot.

Resolution:

- Keep Screenshot as a direct shortcut.
- Keep Add Screenshot inside Receipt sheet only if it helps.
- Both paths create the same image Receipt type.

### Issue 4: No-scroll rule can break long content

Long Notes, AI outputs, Patterns, and Search results will not always fit.

Resolution:

- Primary screens remain fixed.
- Long Note opens focused reader.
- AI response opens paged Perspective modal.
- Search results are paginated.
- View All screens are paginated.

### Issue 5: Patterns preview could confuse free users

The flow includes Patterns Preview.

Resolution:

- Paid users see functional Patterns.
- Free users may see only upgrade preview with no paid insights exposed.
- Do not imply free users have full Patterns access.

### Issue 6: Categories introduce another organizational layer

Categories help navigation, but too many categories could recreate clutter.

Resolution:

- Show All, Work, Personal, Family by default.
- Allow Add Category.
- Cap visible category cards to 4 per page.
- Use paging or More tile for additional categories.
- Do not turn Categories into a complex taxonomy system.

---

## 31. Google Antigravity mission structure

Google Antigravity should execute the build as a multi-agent mission.

Antigravity is the agentic development platform. These are workstreams for its agents.

### 31.1 Product Spec Agent

Owns:

- Canonical spec
- Acceptance criteria
- Entitlement table
- Non-negotiables
- Drift prevention

### 31.2 UX Systems Agent

Owns:

- IA
- Onboarding
- No-scroll interaction model
- Empty states
- Carousel behavior
- Category behavior
- Lock UX
- Expanded menus
- Search flow
- Perspective selection clarity

### 31.3 Visual Design Agent

Owns:

- Design system
- Color tokens
- Rose gold treatment
- Typography
- Components
- Motion rules
- Paper clip system
- Premium emotional tone
- Home visual consistency

### 31.4 Frontend iOS Agent

Owns:

- React Native + Expo EAS Development Build implementation
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

SwiftUI/native iOS is fallback only if required native behavior cannot be satisfied through React Native + Expo EAS Development Builds.

### 31.5 Backend Engineering Agent

Owns:

- Schema
- APIs
- Auth
- Entitlements
- Receipt validation
- Storage quotas
- Search index
- OCR jobs
- AI generation endpoints
- Export jobs
- Admin view

### 31.6 AI Prompting Agent

Owns:

- Structured outputs
- Perspective prompts
- Safety constraints
- Unfiltered tone ladder
- Regen rubric
- Scope handling
- Pattern proof requirements

### 31.7 QA Agent

Owns:

- Locks
- Offline
- Drafts
- Revert
- Quotas
- OCR consent
- Subscription state changes
- Panic hide
- Search
- AI safety
- Accessibility
- Technical platform blockers
- No-scroll behavior

### 31.8 Growth and SEO Agent

Owns:

- Marketing site
- ASO
- App Store screenshots
- SEO blog plan
- Pricing page
- Analytics funnel
- Launch messaging

---

## 32. Screen-by-screen haptic checklist

### 32.1 Splash and Auth

- Splash: no haptic
- Sign in with Apple tap: Micro-Interaction, 100 to 150 ms
- Sign-in fail: Warning, 2 x 150 ms

### 32.2 Onboarding

- Step transition: Navigation Tick, 50 to 80 ms
- Button tap: Micro-Interaction, 100 to 150 ms
- First Note saved: Success Reward, 400 ms
- Onboarding completion: Milestone Signal, 500 to 800 ms

### 32.3 Home

- Dock item tap: Navigation Tick, 50 to 80 ms
- Carousel snap: Navigation Tick, 50 to 80 ms
- Add Note tap: Micro-Interaction, 100 to 150 ms
- Search focus: no haptic
- Search result open: Navigation Tick, 50 to 80 ms

### 32.4 Box Detail

- Open Box: Navigation Tick, 50 to 80 ms
- Open ellipsis: Micro-Interaction, 100 to 150 ms
- Sort selection: Micro-Interaction, 100 to 150 ms
- Date picker confirm: Micro-Interaction, 100 to 150 ms

### 32.5 Note Composer

- Typing: no haptic
- Save tap: Micro-Interaction, 100 to 150 ms
- Save success: Success Reward, 400 ms
- Save error: Warning, 2 x 150 ms

### 32.6 Note Detail

- Perspective selection: Micro-Interaction, 100 to 150 ms
- Long-press preview: no haptic
- Regen tap: Micro-Interaction, 100 to 150 ms
- Regen complete: Success Reward, optional and used sparingly

### 32.7 Receipts

- Add Receipt: Micro-Interaction, 100 to 150 ms
- OCR start: no haptic
- OCR success: Success Reward, optional
- OCR fail: Warning, 2 x 150 ms

### 32.8 Patterns

- Open Patterns: Navigation Tick, 50 to 80 ms
- Open insight: Navigation Tick, 50 to 80 ms
- Dismiss or snooze: Micro-Interaction, 100 to 150 ms

### 32.9 Paywall

- Upgrade tap: Micro-Interaction, 100 to 150 ms
- Not now tap: Micro-Interaction, 100 to 150 ms
- Purchase success: Success Reward, 400 ms
- Purchase fail: Warning, 2 x 150 ms

### 32.10 Profile and Settings

- Toggle change: Micro-Interaction, 100 to 150 ms
- Security confirmation: Micro-Interaction, 100 to 150 ms
- Critical security alert: Critical Alarm, greater than 1000 ms

---

## 33. QA ship blockers

A build fails QA if any blocker occurs.

### 33.1 Draft and data integrity blockers

- Draft is lost after backgrounding
- Draft is lost after crash
- Draft is lost after lock
- Dictation draft is lost where persistence was claimed
- Offline save duplicates Note without idempotency handling
- Edit overwrites original without version history
- Revert does not restore previous version
- User text is silently discarded

### 33.2 Privacy and safety blockers

- App does not blur in app switcher
- Panic hide deletes anything
- App returns to wrong place after privacy lock
- Live moderation appears while typing
- Private Note text is sent to analytics
- Private content is used for model training by default
- Notifications show sensitive content in v1
- User can create a Box, Note, Receipt, OCR job, Search index row, Pattern, export, or AI response before adult eligibility is complete
- Declined eligibility leaves a private-content-capable account active
- Stale SecureStore token reopens private content without server-side session validation
- Crisis resource card is shown in an unsupported launch region

### 33.3 Entitlement blockers

- Free locked Box hides old content
- Free can exceed caps without entitlement
- Paid user blocked incorrectly
- Regen limits enforced only client-side
- StoreKit receipt mismatch possible
- Stripe checkout appears inside iOS
- Free user sees full paid Patterns without entitlement
- Legal privacy data access request is blocked because the user is free or not subscribed

### 33.4 Receipt and OCR blockers

- OCR runs automatically
- Receipt is used in AI without Use in response
- Extracted text cannot be deleted separately
- Attachment quota not checked before upload
- Video upload allowed in v1
- Audio recording starts without explicit tap, visible recording state, duration, or stop/cancel controls
- Audio is transcribed or used in AI without explicit user action

### 33.5 Search blockers

- Search misses Add more
- Search misses People names
- Search misses extracted OCR
- Search includes unextracted OCR
- Search result does not open at match
- Highlighting fails for found keyword

### 33.6 AI blockers

- Chat thread appears
- Three Perspectives do not generate after Save
- Free user cannot view all three Perspectives
- Unfiltered encourages harassment, revenge, doxxing, stalking, or violence
- AI diagnoses a person as fact
- Patterns show claims without proof snippets
- Regen only paraphrases

### 33.7 UI drift blockers

- Home becomes a mood tracker
- Home becomes a dashboard
- Home becomes a prompt feed
- Paper clip appears on Box cards
- Rose gold used as body text
- Blue becomes primary accent
- UI feels scrapbook cute
- App uses therapy copy
- Primary screens vertically scroll
- Bottom dock becomes chunky
- Categories becomes a complex taxonomy dashboard

### 33.8 Technical platform blockers

- App only runs in Expo Go
- App cannot produce an Expo EAS Development Build
- App cannot be distributed to founder's iPhone through TestFlight or approved internal build flow
- Apple Developer ownership sits with a third party instead of founder or NoteBox business entity
- StoreKit cannot be tested end-to-end
- Account deletion endpoint cannot be tested end-to-end
- Adult eligibility gate cannot be tested end-to-end
- Sign in with Apple cannot be tested end-to-end
- Panic hide relies on unsupported workaround
- Secure drafts rely on unsupported workaround
- Haptics rely on unsupported workaround
- Native module requirement is ignored instead of escalated

---

## 34. Final non-negotiables

These are absolute.

- App name is NoteBox.
- iOS-first.
- React Native + Expo EAS Development Builds approved for v1.
- Expo Go only is not approved for production.
- No-code is prototype-only unless every native and privacy requirement is proven.
- Apple Developer Program account required.
- Apple Developer account must be owned by founder or NoteBox business entity.
- StoreKit subscriptions for iOS.
- Stripe only abstracted for web later.
- Backend mandatory.
- Sign in with Apple.
- Home uses locked v2 design.
- Home tagline is exactly: Private Boxes for real-life context.
- Home has connected search and category tray.
- Home has circular Box carousel and global search.
- Carousel ordered by recency.
- Boxes are people, situations, topics, or events.
- Home + Add Note defaults to selected Box.
- Bottom dock is Categories, plus, Profile.
- Profile replaces Settings as the visible user-facing settings entry.
- Patterns are paid-only and not a default free-user tab.
- Notes live inside Boxes.
- Receipts attach to Notes.
- Paper clip appears only on individual Notes with Receipts.
- No video in v1.
- No automatic OCR.
- No Receipt used in AI unless user selects Use in response.
- Draft autosave is mandatory.
- Panic hide is mandatory.
- No push notifications in v1.
- No live moderation while typing.
- No chat thread in v1.
- All three Perspectives generate after Save for everyone.
- Free users can view all three Perspectives.
- Perspective cards show sub-headlines at selection time.
- Aligned sub-headline: Feel understood, right now.
- Objective sub-headline: Outside perspective.
- Unfiltered sub-headline: No holding back.
- Long-press Perspective preview exists.
- Long-press Perspective preview has no haptic.
- Unfiltered label stays Unfiltered.
- Unfiltered intensity levels are Mild, Bold, Savage.
- Unfiltered default is Bold.
- No global Unfiltered intensity default setting.
- Free regen is 1 per Note total.
- Paid regen is 5 per Note per state.
- Trial regen is unlimited.
- Free has 5 active Boxes.
- Free has 5 Notes per Box.
- 4th Note warning shown once.
- 5th Note locks Box for writing.
- Locked Boxes remain readable.
- Free can archive Boxes to free active slots.
- Search is required.
- Search includes Notes, Add more, Box titles, People names, extracted OCR.
- In-Box search exists.
- Date sorting and date range exist at Box level.
- Patterns are paid only.
- Patterns require proof snippets.
- No hallucinated pattern evidence.
- No mood tracking.
- No streaks.
- No prompts.
- No gratitude journaling language.
- No therapy claims.
- No AI companion positioning.
- No domestic abuse evidence positioning.
- Category is Lifestyle.
- Marketing site is required.
- Analytics track actions, not private text.
- Do not train on private content by default.
- Visual system is warm ivory, charcoal, muted sage, muted blush, rose gold.
- No blue accent.
- Rose gold is accent only.
- UI is premium, composed, not scrapbook cute.
- Accessibility support is required.
- Adult eligibility self-attestation is required before private content collection.
- No DOB, ID, or selfie verification in v1 unless counsel explicitly requires it.
- Delete Account must be available in-app.
- Legal privacy data access requests must not be blocked by subscription status.
- Home status/bell icon must not request push notification permission in v1.
- No social feed, public profiles, messaging, public UGC, or community features in v1.
- Audio recording requires explicit tap, visible recording state, and stop/cancel controls.
- SecureStore is for small secrets only, not Notes, drafts, Receipts, OCR, or AI outputs.
- Privacy claims must match actual AI-provider and storage behavior.
- Crisis/safety resources must match launch geography.
- Multisensory feedback must sync within 55 ms when audio, haptic, and visual feedback are layered.
- QA blockers in this document must be enforced.

---

## 35. Build acceptance summary

A v1 build is acceptable only when a user can:

1. Sign in with Apple.
2. Complete adult eligibility before collecting private content.
3. Create a Box.
4. Add a Note within 3 taps after required account and eligibility gates are completed.
5. Save a Note and see all three Perspectives.
6. Understand each Perspective before selecting it.
7. Add Receipts without automatic analysis.
8. Search globally and inside a Box.
9. Highlight a searched word inside a Note.
10. Sort Notes newest or oldest and filter by date range inside a Box.
11. Add People and tag them in Boxes and Notes.
12. See paper clip only on Notes with Receipts.
13. Hit free limits and still read all old content.
14. Upgrade through StoreKit.
15. Restore purchases.
16. Use panic hide without losing drafts.
17. Export content if paid or trial.
18. Access Patterns if paid.
19. Trust that private text is not analytics data.
20. Use the app without therapy-coded prompts, mood tracking, chat loops, or fluff.
21. Review a real iPhone build through TestFlight or approved Expo EAS internal build flow.
22. Ship through a founder-owned or NoteBox-owned Apple Developer Program account.
23. Use the v2 no-scroll primary screen model without hidden vertical feeds.
24. Delete account inside the app and clear local/private data.
25. Submit or route legal privacy data access requests without requiring a paid subscription.
26. Record audio only after explicit tap with visible recording state.
27. Avoid public social or UGC distribution features entirely in v1.
28. Handle stale SecureStore tokens without reopening private content.
29. Match crisis/safety resources to launch geography.

---

## 36. 10th man audit

### Strongest objection 1

The no-scroll rule could create artificial constraints and make real content hard to read.

Countermeasure:

Primary screens stay fixed, but long content opens focused reader modals, paged modals, or paginated result views. No-scroll is a presentation and navigation rule, not an excuse to truncate user records.

### Strongest objection 2

The new bottom dock could conflict with prior IA and make Patterns harder to discover.

Countermeasure:

v2 explicitly promotes Categories, Add Note, and Profile as the Home control system because they serve the record-first workflow. Patterns remain paid-only and can be accessed through Profile, upgrade preview, or a paid-only navigation surface. The product should not over-promote AI or Patterns before the user has built a record.

### Strongest objection 3

The bell/status icon could imply notifications even though v1 bans notifications.

Countermeasure:

Treat it as account/status notices only in v1, or replace it with a shield/lock/status icon if testing shows confusion. No daily reminders, streak nudges, or re-engagement notifications ship in v1.

### Strongest objection 4

The product could drift into cute shoebox or therapy journal.

Countermeasure:

No therapy claims. No prompts. No mood tracking. No chat. Paper clip only on Notes. Home stays clean. Boxes are functional compartments, not scrapbook pages. Perspective is visible and structured, but AI never replaces the record.

### Strongest objection 5

The free lock mechanic could feel manipulative.

Countermeasure:

4th Note warning. 5th Note locks only new writing. Everything remains readable. Not now is visible. No warning haptic. No red styling. No data hostage behavior.

Final 10th man verdict:

This v3.4 handoff is build-ready if the team preserves the working v2 flow and implements the added adult eligibility, account deletion, provider-retention, SecureStore, no-social, audio-consent, and notification clarification rules without redesigning the app.

---

## 37. Compliance reference notes for implementation

These notes are operational guardrails for Antigravity. They are not legal advice. If counsel gives different instructions, update this handoff explicitly.

- Apple App Review requires accurate disclosure, StoreKit for in-app digital subscriptions, Sign in with Apple where applicable, privacy-respecting permission requests, and in-app account deletion for apps that create accounts.
- Apple App Store Connect age ratings are determined by questionnaire and vary by region. NoteBox should complete the questionnaire honestly and keep in-app copy adult-positioned without inventing a final rating.
- COPPA applies to online services directed to children under 13 and to general-audience services with actual knowledge that they collect personal information from children under 13. NoteBox is not a child-directed product, and v1 uses adult self-attestation before collecting private content.
- If using OpenAI API or another AI provider, do not opt in to model training with private Note content. Do not claim zero retention unless the vendor contract supports that claim.

Implementation stance:

```text
Build the working app.
Patch the guardrails.
Do not restart design.
Do not over-collect data.
Do not overpromise privacy.
```

End of v3.4 master handoff.
