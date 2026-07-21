# QA Ship Blockers

A build fails QA if any of the following occur.

## Technical platform blockers

- App only runs in Expo Go
- App cannot produce an Expo EAS Development Build
- App cannot be distributed to the founder's iPhone through TestFlight or approved internal build flow
- Apple Developer ownership sits with a third party instead of founder or NoteBox business entity
- StoreKit cannot be tested end-to-end
- Sign in with Apple cannot be tested end-to-end
- Panic hide relies on unsupported workaround
- Secure drafts rely on unsupported workaround
- Haptics rely on unsupported workaround
- Native module requirement is ignored instead of escalated

## Draft and data integrity blockers

- Draft is lost after backgrounding
- Draft is lost after crash
- Draft is lost after lock
- Dictation draft is lost where persistence was claimed
- Offline save duplicates Note without idempotency handling
- Edit overwrites original without version history
- Revert does not restore previous version
- User text is silently discarded

## Privacy and safety blockers

- App does not blur in app switcher
- Panic hide deletes anything
- App returns to wrong place after privacy lock
- Live moderation appears while typing
- Private Note text is sent to analytics
- Private content is used for model training by default
- Notifications show sensitive content in v1

## Entitlement blockers

- Free locked Box hides old content
- Free can exceed caps without entitlement
- Paid user blocked incorrectly
- Regen limits enforced only client-side
- StoreKit receipt mismatch possible
- Stripe checkout appears inside iOS

## Receipt and OCR blockers

- OCR runs automatically
- Receipt is used in AI without Use in response
- Extracted text cannot be deleted separately
- Attachment quota not checked before upload
- Video upload allowed in v1

## Search blockers

- Search misses Add more
- Search misses People names
- Search misses extracted OCR
- Search includes unextracted OCR
- Search result does not open at match
- Highlighting fails for found keyword

## AI blockers

- Chat thread appears
- Three Perspectives do not generate after Save
- Free user cannot view all three Perspectives
- Unfiltered encourages harassment, revenge, doxxing, stalking, or violence
- AI diagnoses a person as fact
- Patterns show claims without proof snippets
- Regen only paraphrases

## UI drift blockers

- Home becomes a mood tracker
- Home becomes a dashboard
- Home becomes a prompt feed
- Paper clip appears on Box cards
- Rose gold used as body text
- Blue becomes primary accent
- UI feels scrapbook cute
- App uses therapy copy
