# NOTEBOX v1 MASTER HANDOFF

> Converted from PDF into Markdown for GitHub and Google Antigravity agent readability.

NOTEBOX v1 MASTER HANDOFF
Audience: Google Antigravity agents, product, design, frontend, backend, AI, QA, App Store, and marketing
Status: Final production build spec
Platform: iOS-first, App Store-bound
Founder workflow: PC-based review through Google Antigravity, Figma, Expo EAS builds, TestFlight, and
iPhone testing
Product name: NoteBox
Previous project name: Noted
Rule: If something is not in this document, it is not part of v1 unless explicitly approved later.
# 0. Read this first
NoteBox is a private system for emotional continuity.
It is not a generic notes app.
It is not a therapy app.
It is not a mood tracker.
It is not an AI chat companion.
It is not a legal evidence product.
NoteBox exists for users who feel something happen, cannot fully process it in the moment, and need
somewhere controlled to put the note, the receipts, the people, and the context so the moment does not
disappear or get rewritten by memory.
The product spine is:
Spiral → Record → Perspective → Clarity → Empowerment
The core promise is:
Empowerment through having everything together.
The record comes first. AI comes second.
If AI disappeared tomorrow, the user’s saved Notes, Receipts, People tags, Search, Boxes, Add more blocks,
exports, and continuity must still make NoteBox valuable.

# 1. Product doctrine
## 1.1 What NoteBox is
NoteBox is an iOS-first private system for emotional continuity.
Users create Boxes for people, situations, topics, or events. Inside each Box, they save Notes. Notes can
include Receipts, screenshots, files, People tags, Add more blocks, and AI Perspectives.
The purpose is not to escalate, obsess, or fight.
The purpose is to keep the moment together so the user can return later with clarity.
## 1.2 Primary user
Primary ICP:
High-functioning women, roughly 20 to 40, emotionally perceptive, intelligent, private, and not interested in
therapy-coded apps.
She may:
Replay conversations at night
Notice patterns but not always articulate them yet
Feel something is off
Minimize her discomfort
Forget exact details later
Gaslight herself over time
Carry emotional labor
Want privacy and control
Reject motivational fluff
Reject wellness branding
Reject endless AI chat
Want something smarter than a journal and calmer than a text thread
## 1.3 What NoteBox is not
NoteBox is not:
A therapist
A venting toy
A roast machine
A mood tracker
A chat companion
A gratitude journal
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

A habit tracker
A streak app
A pink self-care app
A domestic abuse evidence app
A legal case file system
A social app
A productivity workspace
A prompt app
A dashboard
A feed
NoteBox is a private record with controlled intelligence layered on top.
## 1.4 Design mandate
Every decision must support:
Empowerment through having everything together.
A feature belongs if it:
Preserves continuity
Respects intelligence
Feels private
Feels controlled
Supports revisiting
Builds pattern awareness
Reduces self-doubt through accumulation
Keeps the user’s words primary
Helps the user trust what happened without becoming dependent on AI
A feature does not belong if it:
Encourages spiraling
Feels chaotic
Feels infantilizing
Feels preachy
Feels like therapy
Feels like social media
Pushes prompts
Turns the app into entertainment
Creates AI dependency
Turns Home into a dashboard
Adds dopamine loops
Adds streaks
Makes the user feel watched
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

# 2. Naming, language, and mental model
## 2.1 App name
User-facing app name:
NoteBox
Previous internal project name:
Noted
All new user-facing product language must use NoteBox.
## 2.2 Mental model
Think of NoteBox like a private shoebox where a user puts notes, receipts, screenshots, memories, and
context connected to a person, situation, or event.
The shoebox metaphor should inform structure.
It must not turn the brand cute.
The feeling is:
Organized
Private
Compartmentalized
Emotional but controlled
Premium
Soft but intelligent
Human without being therapy-coded
The metaphor should not become:
Scrapbook
Stationery gimmick
Juvenile
Cute wellness
Decorative clutter
Craft app
Memory album
Case file
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 2.3 User-facing terminology
Use these terms in the app:
Box
Note
Add more
Receipts
People
Perspective
Aligned
Objective
Unfiltered
Avoid these user-facing terms:
Container
Entry
Addendum
Attachment
Journal
Mood
Therapy
Reflection prompt
Relationship
Evidence
Case file
Incident
Report
Diagnosis
Abuse log
Mental health record
## 2.4 Internal terminology mapping
Backend and internal code may use canonical system terms if needed, but the UI must use NoteBox terms.
Internal → User-facing:
Container → Box
Entry → Note
Addendum → Add more
Attachment → Receipt
Person profile → Person
AI response → Perspective
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 2.5 Box naming rule
Box cards show the clean name only.
Examples:
Andy
Work
Mom
School
Wedding weekend
Apartment
Boss
Co-parenting
Do not display “Andy’s Box” everywhere.
Use “Box” only in supporting copy, empty states, and instructional UI.
Correct:
Card title: Andy
Empty state: Nothing in this Box yet.
CTA: Add Note
Incorrect:
Andy’s Box
Work Box
Relationship Box
Emotional Container
## 2.6 Tone rules
Tone is:
Premium
Editorial
Composed
Direct
Slightly sassy when appropriate
Controlled
Adult
Emotionally aware without being therapy-coded
Warm, but not fluffy
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Tone is not:
Motivational
Preachy
Clinical
Cute
Overly soft
Infantilizing
Wellness-branded
Overly forensic
Legalistic
Meme-like
Mean for entertainment
# 3. Technical platform lock
## 3.1 Platform status
NoteBox v1 is iOS-first and App Store-bound.
The app must be shippable through Apple App Store review.
The app must support TestFlight for founder and beta tester review.
## 3.2 Founder environment
Founder is working from a PC.
Founder does not need to own a Mac.
Google Antigravity is the development environment and agentic build workspace.
Google Antigravity is not a contractor and not a person. It is the agentic development platform that will
execute tasks, generate code, run checks, produce artifacts, and verify implementation.
## 3.3 Approved implementation path
Approved production path for v1:
React Native
Expo EAS Development Builds
Expo EAS cloud build workflow
TestFlight for iPhone review
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

App Store deployment through founder-owned Apple Developer Program account
Not approved for production v1:
Expo Go only
Pure no-code production build
Local-only prototype
Stripe checkout inside iOS
Any workflow that blocks StoreKit, Sign in with Apple, panic hide, encrypted drafts, secure storage,
haptics, receipts, OCR consent, TestFlight, or App Store compliance
## 3.4 Why React Native + Expo EAS is approved
React Native + Expo EAS is approved because:
Founder is on PC
Expo EAS supports cloud iOS builds
Founder can review real builds on iPhone
It supports faster visual iteration
It keeps future Android optional without forcing Android into v1
It avoids requiring founder to run Xcode locally
This is not permission to build a shallow Expo toy app.
This must be a serious Expo EAS Development Build with native-capability proof.
## 3.5 Expo Go is not enough
Expo Go is not approved as the production runtime.
Reason:
NoteBox requires native capabilities and production app behavior, including:
StoreKit subscription flow
Sign in with Apple
secure storage
local encrypted drafts
haptics
app lifecycle handling
panic hide
app switcher blur
image picker
document picker
audio receipt handling
TestFlight delivery
App Store compliance
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Expo Go can be used only for early visual experiments if helpful.
Production must use Expo EAS Development Builds or another approved native-capable build path.
## 3.6 Native fallback rule
SwiftUI/native iOS remains the fallback path.
Escalate a feature to custom native module or SwiftUI/native iOS if React Native + Expo EAS cannot cleanly
satisfy any required behavior.
Fallback triggers:
StoreKit cannot be tested end-to-end
Sign in with Apple cannot be implemented cleanly
Face ID / Touch ID cannot be implemented cleanly
app switcher blur is unreliable
panic hide is unreliable
encrypted local drafts are unreliable
haptics cannot match spec
file/photo/document picker behavior is broken
TestFlight delivery is blocked
App Store compliance is compromised
## 3.7 Apple Developer Program ownership
An Apple Developer Program account is required.
The account must be owned by:
Founder, or
NoteBox business entity
Builders, contractors, tools, or agents may be granted access.
They must not own:
Apple Developer account
App Store Connect account
bundle identifier
certificates
provisioning profiles
subscription products
app listing
revenue ownership
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 3.8 StoreKit definition
StoreKit is Apple’s in-app purchase and subscription framework.
For NoteBox, StoreKit means:
User taps Start Trial or Upgrade
Apple purchase sheet opens
Apple handles payment through the App Store
Apple handles subscription billing and renewals
NoteBox backend verifies Apple subscription status
Backend unlocks paid entitlements
No Stripe checkout inside iOS.
Stripe may exist later for web, mapped to the same backend entitlement system.
## 3.9 Founder review workflow
Founder-facing review must be possible without a Mac.
Required review methods:
Figma clickable prototype for screen and design review
Google Antigravity screenshots for build progress
Google Antigravity recorded walkthroughs for flow review
Expo EAS internal builds when appropriate
TestFlight builds for real iPhone testing
App Store Connect access owned by founder or NoteBox business entity
Founder must be able to see:
Home
Box carousel
Note composer
Perspective cards
Receipt handling
Search
Privacy blur
Paywall
Settings
Locked Box state
Patterns preview if paid
## 3.10 No-code rule
No-code platforms may be used for prototypes only.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

No-code is not approved for production v1 unless it proves every locked requirement, including:
StoreKit
Sign in with Apple
panic hide
encrypted drafts
secure storage
OCR consent
search indexing
version history
regen limits
backend entitlement enforcement
exports
App Store review readiness
Default decision:
No-code is prototype-only.
# 4. App structure and navigation
## 4.1 Bottom navigation
Bottom tabs:
Home
Patterns, paid only, hidden for free
Settings
No global hamburger menu.
## 4.2 Contextual expanded menus
Power controls live behind contextual ellipsis menus.
Use ellipsis menus on:
Box Detail
Note Detail
Perspective cards
Pattern insight cards
Settings subsections when needed
Do not use global hamburger navigation.
•
•
•
•
•
•
•
•
•
•
•
•
1.
2.
3.
•
•
•
•
•

Do not hide primary actions behind menus.
Primary actions must remain visible:
Search
Add Note
Save Note
Perspective selection
Upgrade CTA when relevant
## 4.3 Primary task rule
Primary task:
Save a Note into a Box.
The user must reach this task within 3 taps from app open after authentication.
Home + Add Note defaults to the currently selected Box in the carousel.
Composer opens with a Box selector pill at top.
Example:
Andy ˅
User can switch the Box before saving.
# 5. Visual design system
## 5.1 Overall vibe
The design should feel like:
Soft cards
Calm negative space
Ovals and soft rectangles
Warm tactile interface
Sophisticated
Feminine-adjacent, not cute
Premium, but not fake luxury
Emotionally safe, but not therapy-coded
Private, not clinical
Simple, not bare
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 5.2 Color palette
Use a warm, soft, premium palette.
Base colors:
Warm ivory background
Soft cream card
Charcoal primary text
Warm taupe secondary text
Muted sage accent
Muted blush secondary accent
Rose gold metallic accent
No blue accent.
The blue from the image reference is rejected.
Rose gold replaces gold.
Rose gold should feel like restrained metallic warmth, not glitter.
Suggested starting tokens:
Warm ivory: #F6F2EF
Soft cream card: #FBF8F5
Charcoal text: #2E2A28
Warm taupe: #6F6763
Muted sage: #C7D4C5
Muted blush: #E9C8C2
Rose gold dark: #B76E79
Rose gold light: #E8B4B8
Rose gold gradient may be used carefully:
B76E79 → #E8B4B8 → #B76E79
## 5.3 Rose gold usage rules
Rose gold is allowed only for:
Primary CTA
Upgrade CTA
Selected state highlight
Subtle underline or highlight
Important confirmation
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Lock icon accent
Unfiltered tone selection highlight
Never use rose gold for:
Paragraph body text
Large backgrounds
Charts
Decorative patterns
Overly shiny elements
Glitter
Chrome effects
## 5.4 Shape language
Use:
Soft rectangles
Rounded cards
Oval pills
Floating circles for primary add actions
Soft bottom sheets
Avoid:
Hard edges
Sharp boxes
Torn paper textures
Scrapbook elements
Decorative clips
Excessive shadows
## 5.5 Paper clip motif
Paper clip is locked as a functional receipt indicator.
Paper clip appears only on individual Notes that have Receipts.
Paper clip does not appear:
On Box cards
On Home carousel cards
On AI Perspective cards
On Patterns
On Settings
Meaning:
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Paper clip means exactly:
This Note has Receipts attached.
It does not mean:
Important
Pinned
Flagged
Locked
Style:
Single-line outline icon
Small
Muted charcoal by default
Rose gold only when the receipt section is active or expanded
No cartoon paper clip
No oversized stationery look
## 5.6 Typography
Use editorial typography.
Headings may use a refined serif or elevated display style if readable.
Body should use a clean sans serif.
Avoid:
Thin low-contrast type
Overly playful fonts
All caps as default
Tiny body text
Minimum body text:
16px equivalent on mobile.
Support Dynamic Type.
## 5.7 Motion
Motion should be subtle.
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Use:
Fade
Gentle lift
Soft slide
Card expansion
Carousel snap
Avoid:
Bounce
Elastic effects
Confetti
Gamified animation
Excessive celebration
Routine UI response animations must stay under 300 ms.
Success and milestone animations may be 400 to 600 ms.
# 6. Onboarding
Onboarding is split into two phases.
This resolves the tension between fast activation and the need to teach the product.
## 6.1 Phase 1: Activation
Goal:
Get the user to the first saved Note within 3 taps.
Steps:
Create first Box
Open composer
Save first Note
No paywall before this.
No notification permission before this.
No photo library permission before the user taps Add Screenshot or Add Receipt.
No long explanation before the user has saved something.
•
•
•
•
•
•
•
•
•
•
1.
2.
3.

## 6.2 Phase 1 screen sequence
Splash
NoteBox wordmark
Warm ivory background
No tagline required
Authentication
Primary:
Sign in with Apple
Do not implement guest private notes in v1.
Reason:
NoteBox is private, account-bound, security-sensitive, and entitlement-based.
Correct interpretation of frictionless entry:
Do not force payment before value
Do not ask for unnecessary profile data
Do not show paywall before aha moment
Let the user create a first Box and first Note after Sign in with Apple
Create first Box
Copy:
Name your first Box
Placeholder examples:
Andy
Work
Mom
Optional:
Add photo
Add person later
CTA:
Create Box
•
•
•
•
•
•
•
•
•
•
•
•

First composer
Header:
Box selector pill, example:
Andy ˅
Main placeholder:
What happened?
Actions:
Add Screenshot
Add Receipt
Tag People
CTA:
Save Note
## 6.3 Phase 2: Guided education
After the first Note is saved, the app teaches the system.
This education should feel integrated, not like a long lecture.
Teach:
Three Perspectives
Perspective sub-headlines
Long-press preview
Unfiltered intensity menu
Scope toggle
People tagging
Receipts
OCR consent
Search
Free lock rules
Panic hide
Passcode
Face ID
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 6.4 Onboarding progress indicator
Progress indicators are required in multi-step onboarding.
Use clear step names.
Example:
Step 1 of 3: Create your first Box
Step 2 of 3: Add a Note
Step 3 of 3: See Perspective
## 6.5 Onboarding copy
Core concept:
NoteBox is where you keep the moments you do not want to lose.
Supporting line:
Each Box holds notes, receipts, and context for a person or situation.
Perspective education:
One note. Three ways to see it.
Aligned
Feel understood, right now.
Objective
Outside perspective.
Unfiltered
No holding back.
Lock explanation:
Free includes 5 Boxes and 5 notes per Box.
After that, a Box locks for new notes, but you can still read everything.
Privacy explanation:
Drafts autosave.
Backgrounding the app hides it.
Nothing gets deleted.

# 7. Home screen
## 7.1 Purpose
Home is the emotional command center, not a dashboard.
Home should feel calm, fast, and obvious.
Home must not show:
Mood tracking
Charts
Analytics
Streaks
Prompts
Gratitude suggestions
Daily reminders
Feed behavior
## 7.2 Layout
Top:
Global search bar
Middle:
Horizontal Box carousel
Below:
Recent Notes from selected Box
Bottom right:
Floating + Add Note button
## 7.3 Search bar
Placeholder:
Search your Boxes
Search is always visible on Home.
•
•
•
•
•
•
•
•
•
•
•
•

## 7.4 Box carousel
Cards represent people, situations, topics, or events.
Carousel behavior:
Ordered by recency
Swipeable horizontally
Search can jump instantly to a Box
Cards are smaller than oversized hero cards so multiple cards can be partially visible
Switching carousel selection updates the Recent Notes section below
Card content:
Box name
Optional avatar/photo
Last updated or small recency signal
No paper clip
No mood icon
No metrics-heavy UI
## 7.5 Recent Notes section
Shows the most recent Notes for the selected Box.
Each row shows:
Note preview
Date
Optional People chips
Paper clip only if that specific Note has Receipts
## 7.6 Quick add behavior
Home + Add Note defaults to the currently selected Box.
Composer opens with Box selector pill.
Example:
Andy ˅
User can change Box before saving.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 7.7 Optional secondary view
A list view of Boxes may exist, but it is not the default.
# 8. Box Detail screen
## 8.1 Purpose
A Box is a compartment for a person, situation, topic, or event.
Box Detail shows the continuity of that space.
## 8.2 Header
Header contains:
Box name
Optional avatar/photo
People chips
Ellipsis menu
People chips may filter Notes in that Box.
## 8.3 Notes list
Default order:
Newest first
Each Note row shows:
Preview text
Date
Optional People chips
Paper clip icon if Receipts exist on that Note
## 8.4 People chip filter
If a Box has People tags, chips appear under the header.
Behavior:
Tap a chip to filter Notes in that Box to Notes tagged with that Person
•
•
•
•
•
•
•
•
•

Tap again to clear
No complex filter drawer
Keep visual and simple
## 8.5 Box ellipsis menu
Menu items:
Search in this Box
Sort
Rename
Archive
Export Box, paid
Delete, soft delete
## 8.6 Sort sheet
Options:
Newest to Oldest
Oldest to Newest
Custom Date Range
Custom Date Range:
Start date
End date
No emotional sorting.
No AI sorting.
No complex filters in v1.
## 8.7 Empty Box state
Copy:
Nothing in this Box yet.
Drop the first note here when something feels worth keeping.
CTA:
Add Note
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 8.8 Locked Box state
When free user attempts to add a Note after the 5th Note:
Modal copy:
This Box is locked for new notes.
You can still read everything.
CTA:
Upgrade to keep adding
Secondary:
Not now
No red styling.
No warning haptic.
This is a plan boundary, not a user failure.
# 9. People system
## 9.1 People profiles
People profiles exist.
Fields:
Name, required
Avatar/photo, optional
Background notes, optional, include in v1 if easy, otherwise v1.1
## 9.2 People tagging
People can be tagged in:
Boxes
Notes
A Person can appear across multiple Boxes.
•
•
•
•
•

Example:
Jessica can be:
Her own Box
Tagged in Work Notes
Tagged in School Notes
## 9.3 Tagging rules
Tagging must be fast.
Do not turn tagging into a long form.
Support quick add during tagging.
Use the label:
People
Do not use:
Relationships
## 9.4 People search indexing
People names are included in global search and in-Box search.
# 10. Note composer
## 10.1 Purpose
The composer is sacred.
The user may be upset, angry, embarrassed, confused, or in a hurry.
The screen must reduce friction and avoid interruptions.
## 10.2 Composer layout
Top:
Back arrow
•
•
•
•

Box selector pill, example: Andy ˅
Main:
Large text input
Placeholder:
What happened?
Below or near composer actions:
Add Screenshot
Add Receipt
Tag People
Native dictation support
Bottom:
Save Note, solid primary CTA
## 10.3 Composer actions
Add Screenshot:
Dedicated button
Opens image picker filtered to images/screenshots
Permission requested only on tap
Add Receipt:
Opens attachment options
Supports images, PDFs, audio, safe docs, links
Tag People:
Opens quick People picker
Allows quick add
Native dictation:
Use iOS native dictation or acceptable iOS dictation support in the approved React Native + Expo EAS
build
Dictation in progress must persist on background if technically feasible
If native dictation persistence cannot be guaranteed, document limitation before v1 approval
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 10.4 Draft autosave
Non-negotiable.
Draft autosaves:
Every 3 to 5 seconds while idle
On background
On app lock
On crash recovery
During dictation interruptions where technically feasible
Draft persists until:
User saves it
User explicitly discards it
Draft must not be lost due to:
Backgrounding
Panic hide
App crash
Lock screen
Dictation interruption
Network failure
## 10.5 Typing is sacred
Do not show:
Live moderation popups
Warning banners
AI suggestions while typing
Prompt suggestions
Emotion labels
Therapy nudges
Safety handling happens after response generation, not while typing.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

# 11. Note Detail screen
## 11.1 Structure
Note Detail includes:
Note body, latest version
Last updated timestamp
Add more blocks with timestamps
Receipts strip
Perspective section
## 11.2 Note ellipsis menu
Menu items:
Edit, paid and trial only
Add more, all plans
Version History, paid and trial
Revert, paid and trial
Export Note, paid and trial
Copy Text, all plans
Delete, soft delete
## 11.3 Add more
Add more is a timestamped block attached to a Note.
It does not overwrite original Note text.
Free users can add more.
Reason:
Add more preserves the record and increases continuity without allowing post-trial editing.
## 11.4 Editing
Trial:
Can edit Notes
Can add more
Can revert
Version history stored
1.
2.
3.
4.
5.
•
•
•
•
•
•
•
•
•
•
•

Free post-trial:
Cannot edit original Note text
Can add more
Can read all content
Paid:
Can edit Notes
Version history stored
Can revert
Two-step save confirmation required
## 11.5 Two-step save confirmation
For paid and trial editing:
User edits → taps Save → modal:
Save changes?
Options:
Save
Cancel
Purpose:
Prevent accidental overwrites.
## 11.6 Version history and revert
Version history:
Store all versions
Show last 3 versions in primary UI
Full list can live in secondary screen
Revert behavior:
View previous
Revert to previous
Keep UI minimal.
•
•
•
•
•
•
•
•
•
•
•
•
•
•

# 12. Perspective system
## 12.1 Core rule
No chat thread in v1.
Perspectives are single-shot responses attached to a saved Note.
User writes Note → saves Note → all three Perspectives generate.
The user’s words are primary.
AI is controlled perspective, not conversation.
## 12.2 Three Perspectives
After saving a Note, NoteBox automatically generates all three:
Aligned
Objective
Unfiltered
Free users can view all three.
Paid and trial users get more control and variation.
## 12.3 Perspective UI copy
Perspective cards show title and sub-headline at selection time.
Locked copy:
Aligned
Feel understood, right now.
Objective
Outside perspective.
Unfiltered
No holding back.
## 12.4 Display behavior
All three cards are visible together.
•
•
•

Each card displays:
Title
Sub-headline
Generated response
Tapping a card may:
Expand it
Collapse it
Focus it
Scroll it into view
Tapping does not trigger first generation.
First generation happens automatically after Save.
## 12.5 Why cards stay visible together
The contrast is the feature.
Do not collapse the three Perspectives into:
A segmented control only
Hidden tabs only
Swipe-only cards
One visible state at a time
Users need to see that this is not just AI output.
It is structured perspective.
## 12.6 Long-press preview
Long-press any Perspective card to show a sample tone preview.
Rules:
Shows once per card per user
Educational only
Not a separate AI call
No haptic on tooltip reveal
2 to 3 lines max
Tooltip must match actual behavior
Example tone previews:
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Aligned:
That would hurt. Anyone in your position would feel shaken by that.
Objective:
From the outside, the key question is what happened, what changed, and what can be verified.
Unfiltered:
This was not confusion. It was a choice. And you are the one carrying the cost.
## 12.7 Aligned behavior
Aligned means emotional alliance.
It should:
Validate
Support
Reinforce
Help the user feel less alone
Avoid fluff
Avoid generic comfort
Avoid therapy language
Sub-headline:
Feel understood, right now.
## 12.8 Objective behavior
Objective means outside perspective.
It should:
Give a clean read
Offer a neutral lens
Point out alternate interpretations
Provide a good-faith devil’s advocate angle when appropriate
Include one question when useful
Avoid automatically siding with the user
Avoid coldness
Sub-headline:
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Outside perspective.
Objective may include a light pattern nudge if the user has typed repeatedly in a short time window, but it
must not make heavy pattern claims unless the paid Patterns system is involved.
## 12.9 Unfiltered behavior
Unfiltered means no holding back.
It should:
Call out the behavior, pattern, excuse, dynamic, or double standard
Feel direct
Feel like the app is done giving unnecessary benefit of the doubt
Help the user stop excusing the thing
Use controlled bite
Stay grounded in the Note
Sub-headline:
No holding back.
Unfiltered must not:
Encourage harassment
Encourage retaliation
Encourage stalking
Encourage doxxing
Encourage violence
Use slurs
Dehumanize people
Diagnose someone as a narcissist, sociopath, or abuser as fact
Become cruelty for entertainment
Important:
Unfiltered is sharp. It is not a roast machine.
## 12.10 Unfiltered intensity
Intensity levels:
Mild
Bold
Savage
Default:
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Bold
Rules:
No global default setting
No per-Box default setting
No “remember my tone” setting
Every new generation defaults to Bold unless user explicitly changes intensity in that Note/session
If user returns to an existing response, show the stored response and its intensity label if needed
Entitlements:
Free:
Sees the intensity control
Default Bold only
Mild and Savage are locked
Selecting locked levels opens upgrade prompt
Trial:
Can select Mild, Bold, Savage
Unlimited regen
Paid:
Can select Mild, Bold, Savage
Regen limits apply
Placement:
Intensity control lives behind Unfiltered card ellipsis
Do not show full controls inline by default
## 12.11 Context scope
Default scope:
This note only
Scope options:
This note only, default
Include this Box history
Include tagged people across Boxes, paid only
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Placement:
Perspective settings menu
Not front-and-center before the first Note save
V1 safest implementation:
First generation uses This note only
User can change scope during regen
Regen with new scope saves a new AI response version for that state
Scope enforcement:
Always cap context
Include Add more blocks
Include receipts only if user explicitly selects Use in response
Never auto-analyze receipts
## 12.12 Regeneration
Free:
1 regen token per Note total
Can apply to one selected state once
Paid:
5 regen per Note per state
Trial:
Unlimited regen
UI:
Regen lives behind expanded controls
Button copy: Say it differently
Optional chips:
More specific
More direct
Softer
Sharper
Optional input:
Add missing detail
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

If used, missing detail is saved as Add more and used in regen.
Regen quality rules:
Must materially change angle
Must not merely paraphrase
Must not repeat key phrases
Must keep chosen state and intensity
Must respect scope
## 12.13 AI implementation
Recommended:
One structured model call returns all three states.
Store outputs separately per state.
Store:
Note ID
State
Response text
Intensity, for Unfiltered
Scope
Created timestamp
Regen version number if applicable
Safety flags if applicable
Token caps enforced server-side.
# 13. Receipts, attachments, screenshots, OCR
## 13.1 Receipts definition
Receipts are attachments connected to a Note.
Supported:
Images
Screenshots
PDFs
Audio files
Safe docs
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Links with rich preview
No video in v1.
No screen recordings in v1.
## 13.2 Attachment limits
Free:
3 receipts per Note
250MB storage
Trial:
10 receipts per Note
5GB storage
Paid:
10 receipts per Note
5GB storage
Storage caps are server-configurable constants.
## 13.3 Receipt display
In Note rows:
Show paper clip icon only if that Note has receipts
In Note detail:
Receipts section
Paper clip icon in section header
Thumbnails or file list below
## 13.4 Dedicated Add Screenshot
Composer has a dedicated Add Screenshot button.
Behavior:
Opens image picker filtered to images
Treats screenshot like any other image receipt
Permission requested only when tapped
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 13.5 Add Receipt
Composer also has Add Receipt.
Supported inputs:
Image
PDF
Audio
Safe doc
Link
## 13.6 OCR consent
Non-negotiable:
Receipts are never auto-analyzed.
OCR runs only when user taps:
Extract text
Use in response
Extracted text is stored so OCR is not rerun unnecessarily.
User must be able to delete extracted text without deleting the receipt.
## 13.7 Use in response
A receipt is included in AI only if user explicitly enables Use in response.
Default:
Not included.
## 13.8 Sharing and screenshots
Do not block iOS screenshots in v1.
Users may screenshot to share.
•
•
•
•
•
•
•

# 14. Search and filtering
## 14.1 Global search
Global search is required.
Location:
Home, top search bar.
Placeholder:
Search your Boxes
Search scope:
Note text, latest version
Add more blocks
Box titles
People names
Extracted OCR text, only if extracted
Do not search:
Unextracted receipts
AI hallucinated data
Pattern summaries as evidence
Deleted content unless explicitly restored or in admin tools
## 14.2 Search results UI
Results grouped by Box.
Each result shows:
Box name
Snippet
Date
Highlighted keyword
Tap result opens Note at match location.
•
•
•
•
•
•
•
•
•
•
•
•
•

## 14.3 Keyword highlighting
When user searches a word, example “yelling”:
Highlight all instances in snippets
Highlight all instances inside Note
Auto-scroll to first match
Provide next-match navigation if multiple matches exist
Highlight style:
Soft rose gold underline or subtle highlight
Not neon block
Must stay premium and readable
## 14.4 In-Box search
Box ellipsis → Search in this Box
Same behavior as global search, scoped to one Box.
## 14.5 Date sorting and filtering
Box-level tools:
Newest to Oldest
Oldest to Newest
Custom Date Range
Date tools apply to:
Box Note list
In-Box search
Global search v1:
Keyword-based
No global dashboard filter UI
Do not turn Home into analytics.
## 14.6 Search implementation
Preferred:
Server-side indexed search
Paginated results
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Debounced query
Cached recent results if possible
Highlight snippets generated safely from stored text
# 15. Limits, locking, and retention mechanics
## 15.1 Free plan caps
Free users get:
5 active Boxes
5 Notes per Box
3 receipts per Note
250MB storage
1 regen token per Note total
View all three Perspectives
Add more allowed
Copy text export only
No Patterns tab
No editing after trial
## 15.2 Fourth Note warning
After the 4th Note is saved in a Box, show a heads-up once.
Tone:
Calm, not punitive.
Example:
One more note can be added to this Box on the free plan.
You will still be able to read everything.
## 15.3 Fifth Note lock
After the 5th Note is saved:
Box becomes locked for writing.
User can still:
Open Box
Read all Notes
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Search within it
View receipts
View Perspectives
Add more, because Add more preserves record continuity and does not create a new Note
User cannot:
Add a new Note to that Box
Upgrade CTA shown when attempting to add.
## 15.4 Archive rule for free
To create a 6th active Box, free user must archive one.
Archived Boxes:
Remain readable
Can be restored only if active Box count is below cap
Should remain searchable if backend supports archived search scope
If archived search is excluded in v1, UI must make that clear
## 15.5 Paid plan
Paid users have:
No active Box cap
No Notes per Box cap
Paid receipt limits and storage caps as defined
Patterns
Editing
Exports
# 16. Patterns
## 16.1 Availability
Patterns tab is paid only.
Hidden for free users.
## 16.2 Philosophy
Patterns are clarity, not courtroom evidence.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Patterns should feel like:
I noticed something.
Not:
Pattern detected. Evidence compiled.
## 16.3 Pattern sources
Patterns may use:
Notes, latest versions
Add more blocks
People tags
Box metadata
Extracted OCR text only if user extracted it
Patterns may not use:
Unextracted receipts
Unsupported AI inference
Hallucinated examples
Claims without stored proof
## 16.4 Patterns tab content
Patterns may include:
People patterns
Recurring sequences
Frequency notes
Cross-Box relationships through People tagging
## 16.5 Proactive pattern surfacing
Rare and high confidence only.
Card copy:
I noticed something.
Buttons:
Show me
Not now
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Not now snoozes for 7 days.
## 16.6 Proof snippets
Pattern insights must include 2 to 3 proof snippets.
Each snippet must include:
Date
Box name
Exact stored quote or excerpt
If there is not enough evidence, do not surface the pattern.
## 16.7 Tone
Measured, editorial, not comedic.
After seeing a core insight, user may optionally view it through a Perspective, but Patterns themselves must
remain grounded.
# 17. Safety, resources, and trust
## 17.1 Typing remains uninterrupted
No live safety popups while typing.
No warning banners in composer.
No content moderation overlays during drafting.
## 17.2 Response-time safety handling
Safety handling occurs after save and during AI response generation.
## 17.3 Self-harm language
If self-harm language appears:
AI tone:
Grounding
No jokes
•
•
•
•
•

No roast tone
No shame
Show optional resources card below response.
Buttons:
View resources
Ask me later
Don’t ask for 12 hours
Resources permanently available in Settings.
Use national hotline numbers in v1.
Device locale support can be added later.
## 17.4 Violence toward others
If violence toward others appears:
AI must:
Not endorse
Not escalate
Match emotion without encouraging action
Redirect away from harm
Avoid tactical advice
No resources card by default unless self-harm or crisis context requires it.
## 17.5 Unfiltered safety
Unfiltered can be direct and sharp.
Unfiltered cannot:
Encourage revenge
Encourage stalking
Encourage harassment
Encourage doxxing
Encourage violence
Dehumanize people
Provide abuse tactics
Diagnose people as fact
Become a roast machine for cruelty
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

# 18. Privacy, panic hide, security
## 18.1 Panic hide
Non-negotiable.
When user locks phone or backgrounds app:
App switcher shows blur
Draft autosaves
Nothing is deleted
On return:
If privacy lock enabled, app opens to privacy lock screen
If not enabled, app shows blurred cover requiring tap to reveal
User returns to exactly where they were
Panic hide is not panic delete.
Nothing is deleted.
## 18.2 Security settings
Settings → Privacy & Security
Options:
Face ID / Touch ID
4-digit PIN
6-digit PIN
Custom numeric
Alphanumeric passcode
Auto-lock timer
Immediate
1 minute
5 minutes
15 minutes
App switcher blur
Panic close gesture, optional if feasible
Hide sensitive notification previews, for future notifications
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 18.3 Password and passcode rules
Passcode options:
4-digit PIN
6-digit PIN
Custom numeric, 8 to 12 digits
Alphanumeric, 8 to 32 characters
Passcode validation is local.
Passcode is never transmitted.
Store securely using iOS secure storage.
## 18.4 Notifications
No notifications in v1.
Do not implement:
Daily reminders
Streak nudges
Emotional prompts
Re-engagement notifications
If notifications are added later:
Hide content previews by default or give explicit Privacy & Security control
No emotionally sensitive content in notification preview
## 18.5 Encryption baseline
Required:
TLS in transit
Encryption at rest using cloud provider managed keys
Local drafts stored encrypted
Secure storage for auth and lock credentials
No custom end-to-end encryption in v1.
## 18.6 Model training and privacy
Track actions, not Note text.
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Do not train on private content by default.
Any future “help improve NoteBox” must be opt-in and separate.
# 19. Export and data portability
## 19.1 Free export
Free:
Copy Note text only
## 19.2 Trial and paid export
Trial and paid:
Export Note as PDF
Export Box as PDF
Download my data as ZIP
## 19.3 Note PDF export
Includes:
Latest Note text
Add more blocks with timestamps
Receipts listed with filenames and types
Embedded images when small
Larger files listed
AI Perspectives included only via toggle, default off
## 19.4 Box PDF export
Includes:
Cover page with Box name and date range
Notes in chronological order
Add more inline
Receipts per Note
AI Perspectives toggle, default off
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 19.5 Download my data
ZIP contains JSON for:
Boxes
Notes
Versions
Add more blocks
Receipt metadata
AI outputs optional
Delivery:
In-app link when ready
Email optional only if email storage exists later
## 19.6 Export jobs
Exports should be async.
User requests export → backend job starts → app polls status → temporary link delivered.
Do not block UI with synchronous export generation.
# 20. Billing, trial, entitlements
## 20.1 iOS billing
iOS app uses StoreKit subscriptions only.
Required:
Restore Purchases visible
Manage Subscription link visible
Privacy Policy URL
Terms URL
Support URL
Backend receipt verification
Backend entitlement assignment
Do not use Stripe checkout inside iOS.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 20.2 Stripe
Stripe is not required for iOS v1.
Build entitlement abstraction so future web Stripe plans can map to the same entitlements.
Stripe webhooks may be added later for web-only flows.
## 20.3 Trial
Trial:
14 days
Full access
Unlimited regen
Editing enabled
Version history enabled
Revert enabled
Patterns enabled
Export enabled
Full Unfiltered intensity selection
## 20.4 Pricing
Target:
$7 to $8 per month, configurable.
Final price can be changed without restructuring entitlements.
## 20.5 Entitlement table
Free
5 active Boxes
5 Notes per Box
Box locked for writing after 5th Note
Existing content readable forever
3 receipts per Note
250MB storage
View all 3 Perspectives
Unfiltered default Bold only
1 regen token per Note total
Cannot edit Note text post-trial
Can add more
Export: copy text only
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

No Patterns tab
Trial
Full access
No Box cap
No Notes cap
10 receipts per Note
5GB storage
Unlimited regen
Can edit
Version history
Revert
All Unfiltered intensities
Scope controls
Patterns
PDF export
Data ZIP
Paid
No Box cap
No Notes cap
10 receipts per Note
5GB storage
5 regen per Note per state
Can edit
Version history
Revert
All Unfiltered intensities
Scope controls
Patterns
PDF export
Data ZIP
## 20.6 Server enforcement
All entitlements are enforced server-side.
Client enforcement alone is not acceptable.
Server must enforce before:
Creating Box
Creating Note
Uploading receipt
Triggering OCR
Running AI generation
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Running regen
Exporting PDF or ZIP
Accessing Patterns
# 21. Backend and APIs
## 21.1 Backend requirement
Backend is mandatory for v1.
No local-only prototype is acceptable for shipping.
## 21.2 Core entities
Suggested schema entities:
User
Subscription
Entitlement
Box
Person
BoxPerson
Note
NoteVersion
AddMore
NotePerson
Receipt
OCRText
AIResponse
RegenUsage
PatternInsight
SearchIndex
ExportJob
SafetyResourceInteraction
AnalyticsEvent
## 21.3 Core APIs
Auth:
Sign in with Apple
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Boxes:
Create
Read
Update
Archive
Restore
Soft delete
List by recency
People:
Create
Update
List
Tag associations
Quick add
Notes:
Create
Read
Update, paid/trial only
Soft delete
Restore
List by Box
List recent by Box
Note versions:
Create version on edit
List versions
Revert
Add more:
Create
List
Receipts:
Create signed upload URL
Confirm upload
List
Delete receipt
Check quota before upload
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

OCR:
Trigger extraction
Store extracted text
Delete extracted text
Use extracted text in search only after extraction
AI generation:
Generate three Perspectives
Store structured output
Respect scope
Respect intensity
Enforce token budgets
Regen:
Regenerate selected state
Enforce limits
Track usage
Patterns:
Generate
List
Proactive insight
Dismiss
Snooze
Search:
Query
Paginated results
Highlight snippets
Scope global or Box
Export:
Request Note PDF
Request Box PDF
Request data ZIP
Poll status
Retrieve temporary link
Settings:
Security preferences
Haptics preferences
Privacy lock settings
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Admin:
User plan
Storage used
Usage counts
Errors
Receipt validation status
## 21.4 Offline and sync
Required:
Idempotent Note creation keys
Local queue for pending saves
Sync on reconnect
Draft survives offline
Receipt upload can retry
Search may show cached local results if possible
Conflict handling:
Last updated wins for displayed Note
Preserve versions
Never silently discard user text
## 21.5 Observability
Required:
Crash logs
Backend tracing
Error monitoring
Receipt validation errors
Export job errors
AI generation failures
OCR failures
Storage quota errors
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

# 22. AI prompting requirements
## 22.1 Structured output
One call should return:
Aligned
Objective
Unfiltered
Each state stored separately.
## 22.2 State behavior
Aligned:
Validate
Reinforce
Support
No fluff
Objective:
Neutral clarity
Outside perspective
Alternate lens
One question when appropriate
Unfiltered:
Sharp reframing
Controlled bite
Call out behavior or dynamic
No harmful escalation
## 22.3 Context rules
Default:
This note only
Optional:
Include Box history
Include tagged people across Boxes, paid only
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Always cap context.
Receipts only included if user enabled Use in response.
OCR text only included if user extracted it.
## 22.4 Safety constraints
AI must not:
Joke about self-harm
Encourage violence
Encourage harassment
Encourage doxxing
Diagnose people as fact
Invent pattern evidence
Claim something happened that is not in stored user text
Treat Patterns as legal evidence
## 22.5 Pattern evidence
Patterns must quote only stored user text.
If proof is insufficient, do not surface the insight.
# 23. Haptics, animation, performance
## 23.1 Haptic taxonomy
Use only these haptic categories.
Navigation Tick:
Duration: 50 to 80 ms
Intensity: Light, 10 to 30 percent
Use: tab switches, carousel snap, back navigation, search result open
Micro-Interaction:
Duration: 100 to 150 ms
Intensity: Medium, 40 to 60 percent
Use: button taps, toggles, menus, Perspective card selection, sort selection
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Success Reward:
Duration: 400 ms
Intensity: Strong, 70 to 100 percent
Use: Save Note success, first Note saved, export complete, purchase success
Milestone Signal:
Duration: 500 to 800 ms
Use: onboarding complete, trial started, upgrade complete
Warning:
Duration: 2 pulses of 150 ms
Use: form error, failed upload, failed payment, destructive confirmation
Critical Alarm:
Duration: greater than 1000 ms
Use only for critical security alerts or session expiry
## 23.2 Haptic rules
No haptics while actively typing
No haptic on long-press Perspective preview
Same haptic intensity for Upgrade and Not now
No dark haptics
Haptics toggle required
Strong intensity reserved for success and critical only
Do not punish privacy-protective choices with alarming haptics
## 23.3 Haptics settings
Settings includes:
Haptics:
Off
Light
Standard
Default:
Standard
Respect setting unconditionally.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 23.4 Audio
Audio off by default everywhere.
Audio is opt-in only.
Audio may be used only on milestone events if enabled.
If audio, haptic, and visual are layered, they must fire within the synchrony window.
## 23.5 Multisensory sync
Maximum delay for fingertip unified event:
55 ms
Use sync for:
Save Note success
Onboarding completion
Purchase success
Do not layer modalities when sync cannot be guaranteed.
## 23.6 Animation timings
Button press feedback:
80 to 150 ms
CTA attention pulse:
200 to 300 ms, use sparingly
Screen transition:
200 to 350 ms
Scroll reveal:
200 to 300 ms
Success celebration:
400 to 600 ms
•
•
•

Routine interface response animation hard cap:
Under 300 ms
## 23.7 Performance targets
First visual credibility impression happens immediately.
Targets:
First render skeleton: as close to instant as possible
Home load: target under 2 seconds
Hard mobile threshold: under or equal to 3 seconds
Every extra second hurts conversion and trust
Prioritize speed and crash reduction before visual polish
Priority order:
Load speed
Crash rate
Data integrity
Security and privacy
Visual polish
Haptics refinement
# 24. Accessibility
Accessibility is a ship requirement.
Must support:
Dynamic Type
High contrast
Minimum 44 by 44 tap targets
Screen reader labels
Reduced motion support
Sufficient color contrast
No metallic text for body copy
Screen reader labels required for:
Paper clip icon
Lock icon
Ellipsis menus
Perspective cards
•
•
•
•
•
1.
2.
3.
4.
5.
6.
•
•
•
•
•
•
•
•
•
•
•

Receipt thumbnails
Search highlights
Add Note button
Add Screenshot button
Add Receipt button
Privacy lock controls
Perspective cards must read:
Title plus sub-headline.
Example:
Aligned. Feel understood, right now.
Receipts must have accessible filenames or user-editable labels.
# 25. Analytics
Track actions only.
Never track private Note text.
## 25.1 Account events
account_created
trial_started
trial_ended
subscription_started
subscription_canceled
payment_failed
## 25.2 Box events
box_created
box_opened
box_archived
box_restored
box_reached_4
box_locked_for_writing
locked_add_note_attempted
upgrade_cta_clicked
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 25.3 People events
person_created
person_tagged_in_note
person_tagged_in_box
## 25.4 Note events
note_created
note_opened
note_edited
note_reverted
add_more_added
note_deleted_soft
note_restored
## 25.5 Receipt events
receipt_added
receipt_use_in_response_toggled
ocr_extract_triggered
ocr_text_deleted
storage_limit_hit
## 25.6 AI events
responses_generated
state_viewed
intensity_selected
scope_selected
regen_clicked
regen_completed
regen_limit_hit
tts_played, only if text to speech ships
## 25.7 Search events
search_performed
search_result_opened
## 25.8 Patterns events
patterns_tab_opened
proactive_pattern_shown
proactive_pattern_opened
proactive_pattern_dismissed
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

pattern_pull_run
## 25.9 Safety resources events
resources_card_shown
resources_opened
resources_snoozed_12h
# 26. App Store, ASO, and marketing site
## 26.1 App Store category
Category:
Lifestyle
Not Health & Fitness.
Not Safety.
Reason:
Avoid therapy-coded wellness category and crisis-documentation positioning.
## 26.2 App Store compliance
Required:
Privacy Policy URL
Terms URL
Support URL
Restore Purchases
Manage Subscription
Sign in with Apple
StoreKit subscription flow
Clear subscription terms
No Stripe checkout in iOS app
## 26.3 App Store screenshot sequence
Screenshots should demonstrate:
Box carousel
•
•
•
•
•
•
•
•
•
•
•
•
•
1.

Create Note
Three Perspectives
Receipts
Search
Locked for writing, readable forever
Privacy blur or panic hide
Patterns, paid
## 26.4 App Store messaging
Avoid:
Therapy
Healing
Mental health
Gratitude
Mood tracker
AI companion
Coach
Best friend
Journaling prompts
Use:
Private record
Pattern clarity
Keep everything together
Notes and receipts
Perspective is optional
Record is primary
Potential subtitle:
Private Record & Pattern Clarity
Potential tagline:
Not your therapist. Not your cheerleader. Your private record.
## 26.5 Marketing site
Marketing site is required.
Recommended stack:
Next.js
2.
3.
4.
5.
6.
7.
8.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Required pages:
Home
Pricing
Privacy
Terms
Support
Blog
Marketing site tone:
Editorial
Private
Smart
Controlled
Anti-therapy without being hostile
Clear about ownership and privacy
Marketing site must avoid:
Therapy claims
Healing claims
Mental health claims
Abuse evidence positioning
Crisis claims
Mood tracking language
## 26.6 GTM strategy
Launch approach:
iOS-first
Product-led
No bloated waitlist requirement
Organic PR and editorial positioning
ASO strong from launch
Product Hunt optional
Community of women who get it, but do not make app social
Positioning:
NoteBox is creating a category around emotional continuity, controlled perspective, and private record
keeping.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

# 27. Ethical UX and anti-pattern rules
## 27.1 Paywall ethics
Do not:
Hide Not now
Use guilt copy
Use fake scarcity
Use alarming haptics on cancellation
Make cancellation harder than signup
Lock access to past user content
Shame free users
Surprise users with lock mechanics
Do:
Explain limits before lock
Show warning at 4th Note
Keep locked Boxes readable
Show Restore Purchases
Show Manage Subscription
Show Cancel anytime where appropriate
## 27.2 Guest checkout interpretation
Do not implement guest private Notes in v1.
Instead:
Do not force payment before value
Keep Sign in with Apple fast
Do not ask for credit card before aha
Introduce trial or upgrade after value is shown
## 27.3 No dark haptics
Do not pair warning haptics with:
Not now
Decline upgrade
Turn off haptics
Turn on privacy controls
Disable analytics
Cancel subscription management flow
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Upgrade and Not now receive the same neutral micro-interaction haptic.
# 28. Google Antigravity mission structure
Google Antigravity should execute the build as a multi-agent mission.
Antigravity is the agentic development platform. These are workstreams for its agents.
## 28.1 Product Spec Agent
Owns:
Canonical spec
Acceptance criteria
Entitlement table
Non-negotiables
Drift prevention
## 28.2 UX Systems Agent
Owns:
IA
Onboarding
Empty states
Carousel behavior
Lock UX
Expanded menus
Search flow
Perspective selection clarity
## 28.3 Visual Design Agent
Owns:
Design system
Color tokens
Rose gold treatment
Typography
Components
Motion rules
Paper clip system
Premium emotional tone
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 28.4 Frontend iOS Agent
Owns:
React Native + Expo EAS Development Build implementation
iOS-first UI behavior
Carousel performance
Draft autosave
Panic hide
Privacy lock
Search UI
Export UI
Dictation support
Attachments
StoreKit integration path
Haptics
Native module escalation if needed
TestFlight delivery pipeline coordination
SwiftUI/native iOS is fallback only if required native behavior cannot be satisfied through React Native +
Expo EAS Development Builds.
## 28.5 Backend Engineering Agent
Owns:
Schema
APIs
Auth
Entitlements
Receipt validation
Storage quotas
Search index
OCR jobs
AI generation endpoints
Export jobs
Admin view
## 28.6 AI Prompting Agent
Owns:
Structured outputs
Perspective prompts
Safety constraints
Unfiltered tone ladder
Regen rubric
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Scope handling
Pattern proof requirements
## 28.7 QA Agent
Owns:
Locks
Offline
Drafts
Revert
Quotas
OCR consent
Subscription state changes
Panic hide
Search
AI safety
Accessibility
Technical platform blockers
## 28.8 Growth and SEO Agent
Owns:
Marketing site
ASO
App Store screenshots
SEO blog plan
Pricing page
Analytics funnel
Launch messaging
# 29. Screen-by-screen haptic checklist
## 29.1 Splash and Auth
Splash: no haptic
Sign in with Apple tap: Micro-Interaction, 100 to 150 ms
Sign-in fail: Warning, 2 x 150 ms
## 29.2 Onboarding
Step transition: Navigation Tick, 50 to 80 ms
Button tap: Micro-Interaction, 100 to 150 ms
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

First Note saved: Success Reward, 400 ms
Onboarding completion: Milestone Signal, 500 to 800 ms
## 29.3 Home
Tab switch: Navigation Tick, 50 to 80 ms
Carousel snap: Navigation Tick, 50 to 80 ms
Add Note tap: Micro-Interaction, 100 to 150 ms
Search focus: no haptic
Search result open: Navigation Tick, 50 to 80 ms
## 29.4 Box Detail
Open Box: Navigation Tick, 50 to 80 ms
Open ellipsis: Micro-Interaction, 100 to 150 ms
Sort selection: Micro-Interaction, 100 to 150 ms
Date picker confirm: Micro-Interaction, 100 to 150 ms
## 29.5 Note Composer
Typing: no haptic
Save tap: Micro-Interaction, 100 to 150 ms
Save success: Success Reward, 400 ms
Save error: Warning, 2 x 150 ms
## 29.6 Note Detail
Perspective selection: Micro-Interaction, 100 to 150 ms
Long-press preview: no haptic
Regen tap: Micro-Interaction, 100 to 150 ms
Regen complete: use Success Reward sparingly, 400 ms, only if product decides it reinforces value
without habituation
## 29.7 Receipts
Add Receipt: Micro-Interaction, 100 to 150 ms
OCR start: no haptic
OCR success: Success Reward, 400 ms, optional
OCR fail: Warning, 2 x 150 ms
## 29.8 Patterns
Open Patterns: Navigation Tick, 50 to 80 ms
Open insight: Navigation Tick, 50 to 80 ms
Dismiss or snooze: Micro-Interaction, 100 to 150 ms
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

## 29.9 Paywall
Upgrade tap: Micro-Interaction, 100 to 150 ms
Not now tap: Micro-Interaction, 100 to 150 ms
Purchase success: Success Reward, 400 ms
Purchase fail: Warning, 2 x 150 ms
## 29.10 Settings
Toggle change: Micro-Interaction, 100 to 150 ms
Security confirmation: Micro-Interaction, 100 to 150 ms
Critical security alert: Critical Alarm, greater than 1000 ms
# 30. QA ship blockers
A build fails QA if any blocker occurs.
## 30.1 Draft and data integrity blockers
Draft is lost after backgrounding
Draft is lost after crash
Draft is lost after lock
Dictation draft is lost where persistence was claimed
Offline save duplicates Note without idempotency handling
Edit overwrites original without version history
Revert does not restore previous version
User text is silently discarded
## 30.2 Privacy and safety blockers
App does not blur in app switcher
Panic hide deletes anything
App returns to wrong place after privacy lock
Live moderation appears while typing
Private Note text is sent to analytics
Private content is used for model training by default
Notifications show sensitive content in v1
## 30.3 Entitlement blockers
Free locked Box hides old content
Free can exceed caps without entitlement
Paid user blocked incorrectly
Regen limits enforced only client-side
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

StoreKit receipt mismatch possible
Stripe checkout appears inside iOS
## 30.4 Receipt and OCR blockers
OCR runs automatically
Receipt is used in AI without Use in response
Extracted text cannot be deleted separately
Attachment quota not checked before upload
Video upload allowed in v1
## 30.5 Search blockers
Search misses Add more
Search misses People names
Search misses extracted OCR
Search includes unextracted OCR
Search result does not open at match
Highlighting fails for found keyword
## 30.6 AI blockers
Chat thread appears
Three Perspectives do not generate after Save
Free user cannot view all three Perspectives
Unfiltered encourages harassment, revenge, doxxing, stalking, or violence
AI diagnoses a person as fact
Patterns show claims without proof snippets
Regen only paraphrases
## 30.7 UI drift blockers
Home becomes a mood tracker
Home becomes a dashboard
Home becomes a prompt feed
Paper clip appears on Box cards
Rose gold used as body text
Blue becomes primary accent
UI feels scrapbook cute
App uses therapy copy
## 30.8 Technical platform blockers
App only runs in Expo Go
App cannot produce an Expo EAS Development Build
App cannot be distributed to founder’s iPhone through TestFlight or approved internal build flow
Apple Developer ownership sits with a third party instead of founder or NoteBox business entity
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

StoreKit cannot be tested end-to-end
Sign in with Apple cannot be tested end-to-end
Panic hide relies on unsupported workaround
Secure drafts rely on unsupported workaround
Haptics rely on unsupported workaround
Native module requirement is ignored instead of escalated
# 31. Final non-negotiables
These are absolute.
App name is NoteBox
iOS-first
React Native + Expo EAS Development Builds approved for v1
Expo Go only is not approved for production
No-code is prototype-only unless every native and privacy requirement is proven
Apple Developer Program account required
Apple Developer account must be owned by founder or NoteBox business entity
StoreKit subscriptions for iOS
Stripe only abstracted for web later
Backend mandatory
Sign in with Apple
Home has Box carousel and global search
Carousel ordered by recency
Boxes are people, situations, topics, or events
Home + Add Note defaults to selected Box
Notes live inside Boxes
Receipts attach to Notes
Paper clip appears only on individual Notes with Receipts
No video in v1
No automatic OCR
No Receipt used in AI unless user selects Use in response
Draft autosave is mandatory
Panic hide is mandatory
No live moderation while typing
No chat thread in v1
All three Perspectives generate after Save for everyone
Free users can view all three Perspectives
Perspective cards show sub-headlines at selection time
Aligned sub-headline: Feel understood, right now.
Objective sub-headline: Outside perspective.
Unfiltered sub-headline: No holding back.
Long-press Perspective preview exists
Long-press Perspective preview has no haptic
Unfiltered label stays Unfiltered
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Unfiltered intensity levels are Mild, Bold, Savage
Unfiltered default is Bold
No global Unfiltered intensity default setting
Free regen is 1 per Note total
Paid regen is 5 per Note per state
Trial regen is unlimited
Free has 5 active Boxes
Free has 5 Notes per Box
4th Note warning shown once
5th Note locks Box for writing
Locked Boxes remain readable
Free can archive Boxes to free active slots
Search is required
Search includes Notes, Add more, Box titles, People names, extracted OCR
In-Box search exists
Date sorting and date range exist at Box level
Patterns are paid only
Patterns require proof snippets
No hallucinated pattern evidence
No mood tracking
No streaks
No prompts
No gratitude journaling language
No therapy claims
No AI companion positioning
No domestic abuse evidence positioning
Category is Lifestyle
Marketing site is required
Analytics track actions, not private text
Do not train on private content by default
Visual system is warm ivory, charcoal, muted sage, muted blush, rose gold
No blue accent
Rose gold is accent only
UI is premium, composed, not scrapbook cute
Accessibility support is required
QA blockers in this document must be enforced
# 32. Build acceptance summary
A v1 build is acceptable only when a user can:
Sign in with Apple.
Create a Box.
Add a Note within 3 taps from activation flow.
Save a Note and see all three Perspectives.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
1.
2.
3.
4.

Understand each Perspective before selecting it.
Add Receipts without automatic analysis.
Search globally and inside a Box.
Highlight a searched word inside a Note.
Sort Notes newest or oldest and filter by date range inside a Box.
Add People and tag them in Boxes and Notes.
See paper clip only on Notes with Receipts.
Hit the free limits and still read all old content.
Upgrade through StoreKit.
Restore purchases.
Use panic hide without losing drafts.
Export content if paid or trial.
Access Patterns if paid.
Trust that private text is not analytics data.
Use the app without therapy-coded prompts, mood tracking, chat loops, or fluff.
Review a real iPhone build through TestFlight or approved Expo EAS internal build flow.
Ship through a founder-owned or NoteBox-owned Apple Developer Program account.
# 33. Three-agent audit
Product audit
Pass.
The handoff preserves the doctrine:
Record first
AI second
No chat
No mood tracker
No therapy coding
No prompt feed
No access hostage behavior
Free content remains readable
Three Perspectives remain the differentiator
Search, People, Receipts, and Patterns preserve continuity
Technical audit
Pass with platform lock.
The handoff now reflects the actual execution environment:
Founder on PC
5.
6.
7.
8.
9.
10.
11.
12.
13.
14.
15.
16.
17.
18.
19.
20.
21.
•
•
•
•
•
•
•
•
•
•
•

Google Antigravity as agentic development platform
React Native + Expo EAS Development Builds approved
Expo Go rejected for production
Apple Developer ownership required
StoreKit required
SwiftUI/native fallback available only when needed
TestFlight review required
Backend mandatory
UX and trust audit
Pass.
The handoff protects:
Typing as sacred
Draft autosave
Panic hide
App switcher blur
OCR consent
Receipt consent
Privacy-forward analytics
Clear paywall ethics
No dark haptics
No hidden critical behavior
No scrapbook drift
# 34. 10th man audit
The strongest objection:
This document could still fail if the build team treats React Native + Expo EAS as permission to cut native
corners.
Countermeasure now locked:
Expo Go is not production.
Native capability proof is mandatory.
StoreKit must work end-to-end.
Panic hide must work.
Encrypted drafts must work.
TestFlight must work.
Apple Developer ownership must remain with founder or NoteBox business entity.
If any required native behavior cannot be satisfied cleanly, the feature must escalate to a custom native
module or SwiftUI/native implementation.
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

The second objection:
The product could accidentally drift into cute shoebox, therapy journal, or AI companion.
Countermeasure now locked:
No therapy claims.
No prompts.
No mood tracking.
No chat.
Paper clip only on Notes.
Home stays clean.
Boxes are functional compartments, not scrapbook pages.
Perspective is visible and structured, but AI never replaces the record.
The third objection:
The free lock mechanic could feel manipulative.
Countermeasure now locked:
4th Note warning.
5th Note locks only new writing.
Everything remains readable.
Not now is visible.
No warning haptic.
No red styling.
No data hostage behavior.
Final 10th man verdict:
This handoff is now build-ready. The product, technical path, privacy model, UX flow, AI constraints,
entitlement logic, App Store requirements, and QA blockers are explicit enough for Google Antigravity
agents to execute without needing hidden context.
End of master handoff.
