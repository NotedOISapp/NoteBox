# NoteBox Design System and Complete User Flow, v2

Status: New locked design direction based on the updated complete user flow board
Output: Design MD for Figma, Antigravity, frontend implementation, and QA
Platform: iOS-first
Primary rule: Primary screens do not vertically scroll

---

## 0. What changed in v2

This v2 design file replaces the previous design MD for the current visual and UX pass.

The new flow locks the warmer cream, rose gold, charcoal, soft neumorphic glass system, and the complete no-scroll screen set shown in the updated user-flow board.

Major changes from the prior design file:

1. The Home screen remains the visual anchor, but the user flow is now formalized around 24 fixed screens.
2. The bottom Home control system is now Categories, center Add, Profile.
3. Search, Categories, Box Detail, Note Detail, Add More, Locked Box, Patterns, Profile, Privacy, View All Boxes, and View All Notes are all explicit screens.
4. Patterns are represented as a paid or preview surface, not as a default free-user tab.
5. Profile is the user-facing entry point for plan, privacy, export, appearance, haptics, and support.
6. The no-scroll rule is preserved by using cards, sheets, modals, horizontal rails, pagination, and fixed panels.
7. The visual system must stay true to the settled Home colors and components.

---

## 1. Product definition

NoteBox is a private system for emotional continuity.

Users create Boxes for people, situations, topics, or events. Inside each Box, they save Notes. Notes can include Receipts, screenshots, files, People tags, Add more blocks, and AI Perspectives.

NoteBox is record-first, AI-second.

If AI disappeared, the saved Notes, Receipts, People tags, Search, Boxes, Add more blocks, exports, and continuity should still make NoteBox valuable.

### Core promise

Empowerment through having everything together.

### Product spine

Spiral -> Record -> Perspective -> Clarity -> Empowerment

### Primary user

High-functioning women, roughly 20 to 40, emotionally perceptive, intelligent, private, and not interested in therapy-coded apps.

She may:

- Replay conversations at night
- Notice patterns but not articulate them yet
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

---

## 2. What NoteBox is not

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

Design must stay private, premium, controlled, and emotionally intelligent without becoming therapy-coded.

---

## 3. Locked visual direction

### Overall vibe

The app should feel:

- Warm
- Premium
- Minimal
- Private
- Editorial
- Soft but intelligent
- Feminine-adjacent, not cute
- Calm, not sterile
- Tactile, not gimmicky
- Organized, not productivity-coded
- Emotionally aware, not therapeutic

### Avoid

- Dark theme
- Wellness-coded visuals
- Florals as default graphics
- Plant shadows
- Gratitude language
- Mood tracking language
- Prompt cards
- Charts
- Streaks
- Cute scrapbook details
- Torn paper
- Decorative clips
- Therapy-coded softness
- Dashboard density
- Black luxury panels
- Blue accents
- Overly shiny chrome

### Design metaphor

Private shoebox, but not literal and not cute.

The metaphor should inform containment, compartmentalization, layering, and privacy.

It should not become a craft app, scrapbook, memory album, therapy journal, or case file.

---

## 4. Locked color system

Use this palette consistently.

```css
:root {
  --warm-ivory: #F6F2EF;
  --soft-cream: #FBF8F5;
  --cream-glass: rgba(251, 248, 245, 0.72);
  --charcoal: #2E2A28;
  --deep-charcoal: #1F2426;
  --warm-taupe: #6F6763;
  --taupe-line: #D8CEC7;
  --muted-sage: #C7D4C5;
  --muted-blush: #E9C8C2;
  --rose-gold-dark: #B76E79;
  --rose-gold-mid: #D98D78;
  --rose-gold-light: #E8B4B8;
  --white-glass-edge: rgba(255, 255, 255, 0.78);
}
```

### Current locked logo treatment

The NoteBox icon uses:

- Top flap: rose gold matching the footer plus button
- Inner box / lower shape: deep charcoal matching the wordmark
- Outer base tile: soft cream / ivory neumorphic tile
- Edge: soft highlight, no hard outline
- Shadow: soft, warm, and subtle

### Rose gold usage rules

Rose gold is allowed for:

- Primary CTA
- Add Note plus button
- Selected category chip
- Selected Perspective state or intensity
- Important confirmation
- Tiny notification/status dot
- Lock icon accent
- Search filter icon accent
- Small active carousel dot

Rose gold is not allowed for:

- Body text
- Large backgrounds
- Long paragraphs
- Charts
- Decorative patterns
- Glitter
- Chrome effects
- Overly shiny surfaces

### No blue accent

Blue is rejected as a primary or secondary accent.

If a system state needs color, use charcoal, warm taupe, muted sage, muted blush, or rose gold.

---

## 5. Typography

### Wordmark and headings

Use a refined editorial serif for:

- NoteBox wordmark
- Major screen titles
- Box names when large
- Section headers

The serif must feel premium and readable, not fragile or fashion-only.

### Body and UI text

Use a clean sans serif for:

- Search placeholder
- Category chips
- Metadata
- Note previews
- Buttons
- Form labels
- Settings rows
- Modal actions

### Type rules

- Minimum mobile body text: 16px equivalent
- Do not use thin low-contrast type
- Do not use playful fonts
- Do not use all caps as the default
- Do not use metallic treatment for body copy
- Serif should not be overused inside dense UI components

---

## 6. Surface and shape language

Use:

- Soft rectangles
- Rounded cards
- Oval pills
- Floating circles for primary add actions
- Soft bottom sheets
- Frosted glass trays
- Subtle inner shadows
- Subtle outer shadows
- Warm textured ivory background
- Neumorphic icon tiles for key icons

Avoid:

- Hard edges
- Sharp boxes
- Torn paper textures
- Scrapbook elements
- Decorative clips
- Excessive shadowing
- Cards standing on a tabletop
- Literal 3D phone renders inside the app UI

### Surface rule

Cards should feel floating, not standing upright.

Depth comes from:

- Soft layered shadows
- Frosted glass
- Slight overlap
- Subtle blur
- Scale changes
- Circular carousel placement
- Neumorphic bevels on action icons

---

## 7. Locked Home screen components

The current Home screen components are locked.

### Home must include

- Warm textured ivory background
- iOS status bar
- Top-left NoteBox icon
- NoteBox wordmark
- Tagline: "Everything together, in the right Box."
- Top-right notification or status circle
- Connected search and category tray
- Search field: "Search your Boxes"
- Filter icon inside the search row
- Category chips: All, Work, Personal, Family, overflow
- Recent Boxes section title
- View all link for Recent Boxes
- Circular floating Box carousel
- Left and right carousel arrows
- Carousel dots
- Selected center Box card
- Side Box cards angled behind in a circular discarded-stack feel
- Recent Notes section title
- View all link for Recent Notes
- Recent Notes compact card with two rows
- 3D-style note icons matching the plus button style
- Slim bottom dock
- Bottom dock item: Categories
- Center rose-gold plus button
- Bottom dock item: Profile
- iOS home indicator

### Home layout hierarchy

```text
Status bar

Icon        NoteBox wordmark                  Status circle
            Everything together, in the right Box.

Connected Search + Category Tray
[ Search your Boxes                         Filter ]
[ All ] [ Work ] [ Personal ] [ Family ] [ ... ]

Recent Boxes                                      View all
←   circular floating carousel with selected Box   →
    carousel dots

Recent Notes                                      View all
[ two compact recent note rows ]

[ Categories ]          [ + ]          [ Profile ]
```

### Home behavior

- Swiping carousel changes selected Box.
- Arrow buttons toggle left and right.
- Carousel snap uses light haptic feedback.
- Selected Box updates Recent Notes.
- Tap Box card opens Box Detail.
- Tap Recent Note opens Note Detail.
- Tap plus opens Composer with selected Box prefilled.
- Tap search opens Search screen.
- Tap Categories opens Categories screen.
- Tap Profile opens Profile screen.
- Notification/status circle opens a small status sheet, not push notification settings.

---

## 8. Box display customization

Users can choose how a Box is displayed:

1. Photo
2. Initial
3. Name only

Cards must support mixed display styles in the same carousel.

Examples:

- Susan uses Photo
- Mom uses Initial
- Apartment uses Photo or Name only

### Box card content

Each Box card shows:

- Optional display visual
- Box name
- Category chip
- Note count
- Ellipsis menu

Optional secondary metadata can be used if space allows:

- Last note timing
- Locked state
- Archived state

### Paper clip rule

Paper clip does not appear on Box cards.

Paper clip appears only on individual Note rows that have Receipts.

---

## 9. Recent Notes component

Recent Notes is a compact fixed-height card with two visible rows.

Each row includes:

- 3D-style icon tile
- Note preview
- Date
- Optional People tag
- Receipt indicator only if that Note has Receipts
- Ellipsis menu

Example:

```text
She said I never sent it, but the screenshot says otherwise.
Yesterday · Receipt attached

Meeting moved after I asked.
Mon · Deborah tagged
```

### Recent Notes icon style

Icons should match the plus button visual language:

- Neumorphic circular or rounded-square icon tile
- Soft cream base
- Subtle bevel
- Rose-gold or charcoal line icon
- Gentle shadow
- Not flat outline icons floating alone

---

## 10. Bottom dock

The bottom dock must remain slim and not chunky.

### Includes

```text
Categories        +        Profile
```

### Rules

- Only one Add Note action on Home: the center plus.
- No separate "Add Note" pill on Home.
- No large footer slab.
- Plus button is rose gold and visually dominant.
- Categories and Profile are secondary.
- Dock remains fixed at bottom.
- Dock uses warm frosted / soft neumorphic surface.
- The bottom dock is a Home control dock, not a global tab bar with Home as a visible item.

---

## 11. No-scroll rule

Every primary screen must fit in one mobile viewport.

No vertical scrolling on primary screens.

When content exceeds the viewport, use:

- Horizontal carousel
- Segmented tabs
- Paged cards
- Bottom sheets
- Modals
- Collapsed previews
- "View all" secondary screens
- Reader modal with pagination
- Result pagination
- Horizontal rails

Do not secretly add vertical scroll to the main screen.

### Exception handling

Long text can open into a focused reading modal or paged view.

Large result sets use pagination.

Lists never become infinite vertical feeds.

---

## 12. Complete user flow map, v2

```text
1 Splash
-> 2 Sign In
-> 3 Create First Box
-> 4 First Note Composer
   -> 5 Add Receipt Sheet
   -> 6 Tag People Sheet
-> 7 Save Success and Perspective Intro
-> 8 Note Detail
-> 9 Perspective Expanded Modal
-> 10 Home

Home
-> Search
-> Categories
-> Box Detail
-> Add More Modal
-> Locked Box Modal
-> Patterns Preview
-> Pattern Detail
-> Profile
-> Privacy and Security
-> Privacy Return
-> View All Boxes
-> View All Recent Notes
```

---

## 13. Screen 1: Splash

### Purpose

Establish brand trust quickly.

### Components

- Centered NoteBox logo icon
- NoteBox wordmark
- Warm textured ivory background
- Optional soft loading fade

### Behavior

- Auto-advances to Sign In if unauthenticated.
- Auto-advances to Home if authenticated and privacy lock is not required.
- Auto-advances to Privacy Return if authenticated and privacy lock is required.

### No-scroll handling

No scroll.

---

## 14. Screen 2: Sign In

### Purpose

Get the user into a private account without turning onboarding into a lecture.

### Components

- NoteBox icon
- NoteBox wordmark
- Headline: "Keep the moments you do not want to lose."
- Subcopy: "Notes, receipts, people, and context, together."
- Primary CTA: Sign in with Apple
- Footer links: Privacy, Terms

### Rules

- No guest private notes in v1.
- No payment before value.
- No notification permission before value.
- No therapy language.
- No motivational claims.
- No long education before the first saved Note.

---

## 15. Screen 3: Create First Box

### Purpose

Teach the Box mental model through action.

### Components

- Header: "Name your first Box"
- Subcopy: "Start with a person, situation, topic, or event."
- Input: Box name
- Example chips: Mom, Work, Apartment
- Display style selector:
  - Photo
  - Initial
  - Name only
- Optional Add photo tile
- CTA: Create Box

### Rules

- Do not call it a container.
- Do not use "relationship" language.
- Do not overexplain.
- Photo permission is requested only if the user taps Add photo.

---

## 16. Screen 4: First Note Composer

### Purpose

Get the first saved Note quickly.

### Components

- Back arrow
- Box selector pill, example: Mom
- Ellipsis menu
- Large text field
- Placeholder: "What happened?"
- Action row:
  - Screenshot
  - Receipt
  - People
  - Dictate
- Bottom CTA: Save Note
- Small "Draft autosaves" reassurance if space allows

### Rules

- Typing is sacred.
- No live moderation popups.
- No AI suggestions while typing.
- No emotional labels.
- No prompts.
- Draft autosaves.
- Save Note remains visible.
- User can change the Box before saving.

---

## 17. Screen 5: Add Receipt sheet

### Trigger

Tap Receipt in Composer or Add Receipt in Add More.

### Components

- Add Screenshot
- Photo Library
- PDF / File
- Audio
- Link
- Cancel

### Rules

- Receipts are never auto-analyzed.
- OCR only runs after Extract Text or Use in response.
- No video in v1.
- Permission only requested when user taps the relevant action.
- Add Screenshot can exist both as a dedicated Composer shortcut and inside this sheet, but the labels must remain consistent.

---

## 18. Screen 6: Tag People sheet

### Trigger

Tap People in Composer, Box Detail, or Add More.

### Components

- Search people
- Recent people row
- Add new person
- Selected people row
- Done

### Rules

- Label is "People".
- Never use "Relationships".
- Quick add must be fast.
- No long form.
- People can be tagged across Boxes and Notes.

---

## 19. Screen 7: Save Success and Perspective Intro

### Purpose

Confirm the record is saved, then introduce controlled intelligence.

### Components

- Confirmation icon
- Header: "Saved to Mom"
- Subcopy: "Your note is kept with this Box."
- Three compact Perspective cards:
  - Aligned, "Feel understood, right now."
  - Objective, "Outside perspective."
  - Unfiltered, "No holding back."
- Primary CTA: See Perspectives
- Secondary CTA: Back to Home

### Rules

- All three Perspectives generate after Save.
- No chat thread.
- No one-state-at-a-time default.
- The contrast between the three Perspectives is the feature.

---

## 20. Screen 8: Note Detail

### Purpose

Show the saved Note, receipts, People, Add more, and Perspectives.

### Components

- Back arrow
- Box chip, example: Mom
- Ellipsis
- Note preview card
- Last updated timestamp
- Segmented tabs:
  - Note
  - Receipts
  - Perspectives
- Summary rows:
  - Add more count
  - Receipts count
  - People tags
- Receipt thumbnail strip if receipts exist
- Bottom actions:
  - Add more
  - Receipts
  - Perspectives

### Note mode

- Note text preview
- Add more blocks preview
- View full Note action if needed

### Receipts mode

- Receipt thumbnails
- Extract text
- Use in response toggle

### Perspectives mode

- Aligned card
- Objective card
- Unfiltered card

### No-scroll handling

Long content opens in a focused reading modal or paged modal.

---

## 21. Screen 9: Perspective Expanded modal

### Trigger

Tap a Perspective card.

### Components

- Back or close
- Perspective title
- Sub-headline
- Ellipsis
- Generated response
- Intensity pills when Unfiltered is selected:
  - Mild
  - Bold
  - Savage
- Footer actions:
  - Say it differently
  - Scope

### Rules

- No chat.
- No open-ended conversation box.
- Regen must materially change angle, not paraphrase.
- Free gets 1 regen token per Note total.
- Paid gets 5 regen per Note per state.
- Trial gets unlimited regen.
- Unfiltered default is Bold.
- Mild and Savage are gated for free users.

---

## 22. Screen 10: Home, locked

### Purpose

Emotional command center.

Home should feel calm, fast, and obvious.

### Components

Use the locked Home screen from Section 7.

### Primary actions

- Tap plus -> Composer opens with selected Box prefilled.
- Tap search -> Search screen.
- Tap Box card -> Box Detail.
- Swipe carousel -> changes selected Box and Recent Notes.
- Tap Recent Note -> Note Detail.
- Tap Categories -> Categories screen.
- Tap Profile -> Profile screen.
- Tap View all under Recent Boxes -> View All Boxes.
- Tap View all under Recent Notes -> View All Recent Notes.

### Must not show

- Mood tracking
- Charts
- Analytics
- Streaks
- Prompts
- Gratitude suggestions
- Daily reminders
- Feed behavior

---

## 23. Screen 11: Search

### Purpose

Fast retrieval, not browsing.

### Components

- Search input
- Cancel
- Filter chips
- Top results
- View more results CTA

### Result card includes

- Box name
- Snippet
- Date
- Highlighted keyword
- People tag if relevant
- Receipt indicator if specific Note has Receipts

### Search scope

Search across:

- Note text
- Add more blocks
- Box titles
- People names
- Extracted OCR text, only if extracted

Do not search:

- Unextracted receipts
- AI hallucinated data
- Pattern summaries as evidence
- Deleted content unless restored

### No-scroll handling

Show top 5 results.

Use View more results to open paged results.

---

## 24. Screen 12: Categories

### Purpose

Manage categories without cluttering Home.

### Components

- Header: Categories
- Subcopy: "Keep your Boxes grouped."
- Category cards:
  - All
  - Work
  - Personal
  - Family
- Add Category action
- Bottom dock can remain visible if it does not crowd the screen

### Category card includes

- Category name
- Number of Boxes
- Most recent Box
- Mini preview of 2 to 3 Box cards or avatars

### No-scroll handling

Show 4 categories max.

If there are more categories, use horizontal paging or a More tile.

---

## 25. Screen 13: Category Detail

### Purpose

Show Boxes inside one category.

### Components

- Header: category name, example Work
- Search in category
- Horizontal Box rail
- Selected Box preview
- Recent Notes from selected Box
- Add Box CTA

### No-scroll handling

Boxes move horizontally.

Recent Notes capped at 2.

---

## 26. Screen 14: Box Detail

### Purpose

Show continuity for one person, situation, topic, or event.

### Components

- Back arrow
- Box display image / initial / name-only visual
- Box name
- Category chip
- Ellipsis
- People chips
- Add Person button
- Notes section
- Horizontal Note cards
- Add Note CTA
- Search in this Box action

### Ellipsis menu

- Search in this Box
- Sort
- Rename
- Archive
- Export Box, paid
- Delete, soft delete

### Empty state

```text
Nothing in this Box yet.
Drop the first note here when something feels worth keeping.
```

CTA: Add Note

---

## 27. Screen 15: Add More modal

### Purpose

Add context without editing the original Note.

### Components

- Header: Add more
- Subcopy: "This keeps the original note intact."
- Text field
- Add Receipt
- Tag People
- Save Add More

### Rules

- Add more is timestamped.
- Add more does not overwrite original Note.
- Free users can add more.
- Add more does not count as a new Note for the locked Box limit.

---

## 28. Screen 16: Locked Box modal

### Trigger

Free user attempts to add a new Note after the 5th Note in a Box.

### Components

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

### Rules

- No red styling.
- No warning haptic.
- No shame copy.
- No data hostage behavior.
- User can still read all existing content.
- User can still Add more to existing Notes if allowed by the plan rules.

---

## 29. Screen 17: Upgrade

### Purpose

Explain paid value clearly and ethically.

### Components

- Header: Keep adding.
- Subcopy: "More Boxes, more Notes, full control."
- Plan card:
  - Unlimited Boxes
  - Unlimited Notes
  - More Receipts
  - Patterns
  - Export
  - Editing
- CTA: Start Trial
- Secondary: Not now
- Restore Purchases

### Rules

- Do not hide Not now.
- Do not use guilt copy.
- Do not fake scarcity.
- Do not lock access to past content.
- Use StoreKit for iOS subscriptions.

---

## 30. Screen 18: Patterns Preview, paid or upgrade preview

### Purpose

Show pattern clarity grounded in proof.

### Components

- Header: Patterns
- Card: "I noticed something."
- Proof snippets preview
- People pattern card
- Recurring sequence card
- Frequency note card
- CTA: View this pattern

### Rules

- Paid-only as a functional tab or full surface.
- Free users may see a limited upgrade preview only if it does not expose paid insights.
- No hallucinated evidence.
- Pattern insights require proof snippets.
- Tone is measured and editorial.
- Not courtroom evidence.

---

## 31. Screen 19: Pattern Detail

### Purpose

Show one grounded insight.

### Components

- Insight title
- Plain-language pattern explanation
- 2 to 3 proof snippets
- Each proof snippet includes:
  - Date
  - Box name
  - Exact excerpt
- Actions:
  - View related Notes
  - View through Perspective

### Optional Perspective view

- Aligned
- Objective
- Unfiltered

### Rules

- Never invent proof.
- Never diagnose a person as fact.
- Do not frame as legal evidence.

---

## 32. Screen 20: Profile

### Purpose

Account, plan, privacy, data, and app controls.

### Components

- Profile header or membership card
- Plan status
- Upgrade pill if free
- Privacy and Security
- Data and Export
- Appearance
- Haptics
- Support
- Sign out

### No-scroll handling

Maximum 6 compact rows plus sign out.

Additional items open sub-screens.

---

## 33. Screen 21: Privacy and Security

### Components

- Face ID / Touch ID toggle
- PIN / Passcode
- Auto-lock timer
- App switcher blur
- Panic close gesture

### Panic hide behavior

When user locks phone or backgrounds app:

- App switcher shows blur.
- Draft autosaves.
- Nothing is deleted.

On return:

- If privacy lock is enabled, app opens to privacy return screen.
- If not enabled, app shows blurred cover requiring tap to reveal.
- User returns to exactly where they were.

---

## 34. Screen 22: Privacy Return

### Trigger

App is backgrounded, locked, or privacy lock is required.

### Components

- Blurred app background
- NoteBox icon
- Tap to reveal
- Optional Face ID prompt

### Rules

- Panic hide is not panic delete.
- Nothing is deleted.
- Draft is not lost.
- The user returns to the prior screen after reveal.

---

## 35. Screen 23: View All Boxes

### Trigger

Home Recent Boxes "View all".

### Components

- Header: All Boxes
- Search
- Category filter
- Two-column mini Box grid, max 6 visible
- Page dots or horizontal pages
- Add Box CTA

### No-scroll handling

Use pages, not an infinite grid.

---

## 36. Screen 24: View All Recent Notes

### Trigger

Home Recent Notes "View all".

### Components

- Header: Recent Notes
- Box filter chip
- 3 Note cards max
- Next page control

### Note card includes

- Preview
- Box name
- Date
- People chip
- Receipt icon only if receipts exist

### No-scroll handling

Three notes per page.

---

## 37. Haptics

Use only these categories.

### Navigation Tick

- Duration: 50 to 80 ms
- Intensity: Light, 10 to 30 percent
- Use: tab switches, carousel snap, back navigation, search result open

### Micro-Interaction

- Duration: 100 to 150 ms
- Intensity: Medium, 40 to 60 percent
- Use: button taps, toggles, menus, Perspective card selection, sort selection

### Success Reward

- Duration: 400 ms
- Intensity: Strong, 70 to 100 percent
- Use: Save Note success, first Note saved, export complete, purchase success

### Warning

- Duration: 2 pulses of 150 ms
- Use: form error, failed upload, failed payment, destructive confirmation

### Rules

- No haptics while actively typing.
- No haptic on long-press Perspective preview.
- Same haptic intensity for Upgrade and Not now.
- No dark haptics.
- Haptics toggle required.
- Strong intensity reserved for success and critical only.

---

## 38. Accessibility

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

---

## 39. Implementation notes for Antigravity

### Build path

- React Native
- Expo EAS Development Builds
- Expo EAS cloud build workflow
- TestFlight for iPhone review
- App Store deployment through founder-owned or NoteBox-owned Apple Developer Program account

### Do not ship as

- Expo Go only
- Pure no-code production build
- Local-only prototype
- Stripe checkout inside iOS

### Production requirements

- Sign in with Apple
- StoreKit subscriptions
- Backend entitlement enforcement
- Secure local drafts
- Panic hide
- App switcher blur
- Image picker
- Document picker
- Audio receipt handling
- OCR consent
- TestFlight delivery

---

## 40. Design QA blockers

A design or build fails if:

- Home becomes a mood tracker.
- Home becomes a dashboard.
- Home becomes a prompt feed.
- Paper clip appears on Box cards.
- Rose gold is used as body text.
- Blue becomes primary accent.
- UI feels scrapbook cute.
- App uses therapy copy.
- Draft is lost after backgrounding.
- Draft is lost after crash.
- App does not blur in app switcher.
- Panic hide deletes anything.
- Private Note text is sent to analytics.
- OCR runs automatically.
- Receipt is used in AI without Use in response.
- Search misses Add more.
- Search misses People names.
- Search misses extracted OCR.
- Chat thread appears.
- Free user cannot view all three Perspectives.
- Patterns show claims without proof snippets.
- Primary screens vertically scroll.

---

## 41. Known user-flow issues to resolve before build

These are not reasons to throw away the flow. They are implementation clarifications.

### Issue 1: Bottom dock differs from older bottom tab spec

The older handoff used Home, Patterns, Settings as bottom tabs. The new locked flow uses Categories, plus, Profile.

Resolution:

- Treat the bottom dock as the new Home control system.
- Profile replaces Settings as the user-facing settings entry.
- Patterns should not be a default visible free-user tab.
- Paid users can access Patterns through Profile, a paid surface, or a paid-only navigation state approved later.

### Issue 2: Bell icon conflicts with "no notifications in v1"

The Home visual includes a bell/status circle.

Resolution:

- In v1, this should act as an in-app status or account notice button only.
- Do not implement daily reminders, streak nudges, re-engagement notifications, or sensitive notification previews.
- If the icon remains a bell visually, its function must not imply push notification behavior in v1.

### Issue 3: Add Screenshot appears both in Composer and Add Receipt sheet

This is acceptable if consistent.

Resolution:

- Keep Screenshot as a direct Composer shortcut.
- Also allow Add Screenshot from the Add Receipt sheet if it helps users.
- Both routes create the same Receipt type.

### Issue 4: No-scroll rule will be stressed by real content

Long Notes, AI outputs, Search results, and Patterns cannot fit forever.

Resolution:

- Main screens stay fixed.
- Long content opens reader modal or paged modal.
- Lists are paginated.
- Search shows top results with "View more results".

### Issue 5: Patterns preview needs entitlement clarity

The flow shows Patterns Preview.

Resolution:

- Paid users see functional Patterns.
- Free users can see a limited upgrade preview only if no paid insight is exposed.
- Patterns are never shown as hallucinated or unsupported claims.

---

## 42. Final locked design summary

NoteBox v2 should feel like a warm, premium, private record system.

The locked Home screen is built around:

- NoteBox wordmark and icon
- Connected search and category tray
- Circular floating Box carousel
- Compact Recent Notes card
- Slim bottom dock
- Rose-gold Add Note button
- Textured warm ivory background
- Charcoal, cream, rose gold, and restrained muted accents

The product must remain:

- Record-first
- AI-second
- No-scroll on primary screens
- No chat
- No mood tracking
- No prompts
- No dashboard
- No therapy-coded language
- No cute scrapbook drift

End of file.
