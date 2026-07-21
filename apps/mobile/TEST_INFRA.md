# NoteBox E2E Testing Infrastructure

This document outlines the visual regression and end-to-end (E2E) testing framework designed for the premium glassmorphic UI redesign of NoteBox.

---

## 1. Overview & Objectives

To enforce the visual aesthetics and legal compliance mandates without introducing the heavy overhead of browser-automation suites (which can be fragile and slow), NoteBox uses a custom Node-based static/dynamic analysis runner.

The primary objectives are:
1. **Premium Style Enforcement**: Statically verify key glassmorphic styles, including border widths (`1.2px`/`2.5px`), translucency boundaries (`rgba(255, 255, 255, 0.45)`), backdrop filters (`blur(30px)` and `blur(24px)`), and typography properties across Web and Native.
2. **Behavioral Integrity**: Ensure the app transitions seamlessly across critical states (first-open splash, neutral age verification, onboarding slide flow, search filtration, and note auto-saving).
3. **Cross-Platform Consistency**: Check that style rules and route mapping render predictably on Web and Native targets.

---

## 2. Testing Architecture

The test suite runs at the workspace root and consists of:
- **Static Analysis Module**: Uses line-by-line parsing and regex lookups to enforce the presence of styling boundaries, package imports, and typography assets.
- **Dynamic Simulation Engine**: Mocks the AsyncStorage layers, routing conditions, theme settings, and viewport parameters. It runs simulated scenarios (such as first-time registration and returned login) through a mock component state pipeline to ensure compliance.
- **TypeScript Static Verification**: Ensures no syntax or type checking errors exist (`npx tsc --noEmit`).
- **Filesystem Verification**: Verifies physical asset properties (file size and directory placement).

---

## 3. Test Tiers & Case Inventory

The E2E suite contains **51 distinct test cases** organized into four tiers:

### Tier 1: Feature Coverage (20 Cases)
- **Typography (5 Cases)**
  - `T1_TYPO_1`: Verify Layout imports `@expo-google-fonts/outfit` and `@expo-google-fonts/playfair-display` packages.
  - `T1_TYPO_2`: Verify Layout uses `useFonts` hook and imports `expo-splash-screen`.
  - `T1_TYPO_3`: Verify all 8 font weights are loaded in layout config.
  - `T1_TYPO_4`: Verify `theme.ts` maps native aliases to loaded font files and web custom properties.
  - `T1_TYPO_5`: Verify `themed-text.tsx` refers to `Fonts` constants rather than system defaults.
- **Grid Cards (5 Cases)**
  - `T1_GRID_1`: Verify cards use frosted border width of `1.2` / `2.5`.
  - `T1_GRID_2`: Verify cards use border color matching `rgba(255, 255, 255, 0.45)`.
  - `T1_GRID_3`: Verify `BOX_SHADOWS` definitions map colored glow drop shadows.
  - `T1_GRID_4`: Verify card selection transforms scale on press state (`0.96` / `1.03` / `1.0`).
  - `T1_GRID_5`: Verify card long press triggers router push to detail screen.
- **Onboarding (5 Cases)**
  - `T1_ONB_1`: Verify onboarding sheets use `backdropFilter: 'blur(30px)'` styles.
  - `T1_ONB_2`: Verify landscape background asset file is present on disk.
  - `T1_ONB_3`: Verify AsyncStorage onboarding completion flag writes.
  - `T1_ONB_4`: Verify slide indices map to pagination progress dots.
  - `T1_ONB_5`: Verify neutral picker dropdown definitions (`MONTHS`, `DAYS`, `YEARS`) exist in AgeGate.
- **Web Tab Bar & FAB (5 Cases)**
  - `T1_WTBF_1`: Verify Web Tab Bar backdrop filter is set to `blur(24px)`.
  - `T1_WTBF_2`: Verify container uses transparent alphas for light/dark mode backings.
  - `T1_WTBF_3`: Verify FAB buttons define circular dimensions with deep shadow offsets.
  - `T1_WTBF_4`: Verify route paths map to specific vector tab icons.
  - `T1_WTBF_5`: Verify `web-badge.tsx` file exists.

### Tier 2: Boundary & Corner Cases (20 Cases)
- **Typography Boundaries (5 Cases)**
  - `T2_TYPO_1`: Verify layout resolves `fontError` cleanly to prevent load crash.
  - `T2_TYPO_2`: Verify splash gate blocks view rendering while loading is active.
  - `T2_TYPO_3`: Verify default fallback styles are present if fonts are missing.
  - `T2_TYPO_4`: Verify monospace uses system monospace fallbacks.
  - `T2_TYPO_5`: Verify line heights are constrained to prevent overlaps.
- **Grid Cards Boundaries (5 Cases)**
  - `T2_GRID_1`: Verify shadow lookup wraps using modulo bounds checking (`% length`).
  - `T2_GRID_2`: Verify cards use text clipping constraints (`numberOfLines`).
  - `T2_GRID_3`: Verify grid rendering handles empty boxes list without crashes.
  - `T2_GRID_4`: Verify border highlight overrides do not break layout dimensions.
  - `T2_GRID_5`: Verify haptic feedback invocations are guarded against failures.
- **Onboarding Boundaries (5 Cases)**
  - `T2_ONB_1`: Verify background image size is greater than 1KB (not empty).
  - `T2_ONB_2`: Verify slide navigation bounds-checks limits.
  - `T2_ONB_3`: Verify birthyear dropdown bounds check (limits selection up to 110 years).
  - `T2_ONB_4`: Verify storage write calls store true status on successful gate verification.
  - `T2_ONB_5`: Verify onboarding screen adapts to narrow responsive viewports.
- **Web Tab Bar & FAB Boundaries (5 Cases)**
  - `T2_WTBF_1`: Verify navigation fallback routes map correctly.
  - `T2_WTBF_2`: Verify FAB button zIndex overlay properties are set.
  - `T2_WTBF_3`: Verify tab list opacity values maintain contrast and readability.
  - `T2_WTBF_4`: Verify platform selector branches prevent web crash on native.
  - `T2_WTBF_5`: Verify web badge layout sizes check styles correctly.

### Tier 3: Cross-Feature Combinations (6 Cases)
- `T3_COMB_1`: Onboarding completion updates storage and transitions routes to Home Screen.
- `T3_COMB_2`: Underage declare or rejected gate blocks view routing.
- `T3_COMB_3`: Theme scheme toggles propagate to Tab Bar glass colors and Grid backgrounds.
- `T3_COMB_4`: ThemedText components propagate Outfit/Playfair typography across screens.
- `T3_COMB_5`: FAB button links navigation targets to `/note/compose`.
- `T3_COMB_6`: Width parameters dynamically adjust responsive columns and navigation width bounds.

### Tier 4: Real-World Application Scenarios (5 Cases)
- `T4_REAL_1`: First-open user funnel (Splash -> Age Gate -> Onboarding -> Home Screen).
- `T4_REAL_2`: Returning verified user bypasses age gates and onboarding.
- `T4_REAL_3`: Draft auto-save periodically persists changes to storage.
- `T4_REAL_4`: AppState transitions to background state update layout listeners.
- `T4_REAL_5`: Text queries filter home grid list contents based on search input.

---

## 4. Execution Commands

To verify visual and logic compilation consistency, run the following commands:

### Type-Checking (Clean Code Verification)
Ensures the codebase compiles with no TypeScript compilation errors:
```bash
npx tsc --noEmit
```

### E2E Test Suite Execution
Runs the 51 compliance checks statically and dynamically:
```bash
node scripts/run-e2e.js
```
