---
name: nowincode
description: Find, inspect, and install React Native (Expo) and plain Web UI/motion pieces from Now In Code using the CLI and Markdown catalog. Use when the user asks to add a Now In Code piece, search for an animated RN/Expo or Web UI interaction, paywall, onboarding flow, chart, or shader effect from nowincode.com.
---

# Now In Code

Now In Code (`https://nowincode.com`) is a library of 204 UI and motion pieces rebuilt from scratch as working **React Native (Expo SDK 54, TypeScript)** and **plain Web (HTML, CSS, JS)** code, with timing and easing constants written at the top of each file.

## Workflow

### 1. Discover pieces (never guess slugs)

Fetch the machine-readable index first to find exact slugs:

- Full catalog index: `https://nowincode.com/llms.txt`
- Browse by tag (Markdown): `https://nowincode.com/tags/<tag>.md` (e.g. `bottom-sheet`, `tab-bar`, `spring`, `shader`, `paywall`, `card-stack`)
- Detailed piece spec (Markdown): `https://nowincode.com/library/<slug>.md`

Always verify the exact `<slug>`, dependencies, and whether it is Free or Pro from the Markdown page before installing.

### 2. Install a piece with the CLI

```sh
# First time only (free account works for the 10 free pieces; Pro/Lifetime unlocks all 204):
npx nowincode login

# Install React Native (Expo) source into components/<slug>/:
npx nowincode add <slug>

# Or install the matching plain web build:
npx nowincode add <slug> --web
```

After `npx nowincode add <slug>` finishes, run the `npx expo install ...` command it prints if the piece has extra dependencies (such as `@shopify/react-native-skia`, `react-native-reanimated`, `expo-blur`, `expo-haptics`, or `react-native-svg`).

### 3. Adapt to the user's app

- Each piece is standalone source you own (not a runtime package).
- Check the named timing, spring, and color constants at the top of the file before editing motion or theme tokens.
- Pieces are developed and tested against **Expo SDK 54**; check the piece's dependency list if the project uses a newer SDK.

## Free MIT pieces (10)

These 10 pieces are free (MIT licensed in `https://github.com/nowincode/nowincode`):

- `hold-to-confirm-glow-fill-button` — Hold-to-Confirm Glow Fill Button (deps: @shopify/react-native-skia, expo-haptics, react-native-svg)
- `sticky-section-headers-with-progressive-blur` — Sticky Section Headers with Progressive Blur (deps: @react-native-masked-view/masked-view, expo-blur, expo-linear-gradient, react-native-svg)
- `morphing-verification-code-input` — Morphing Verification Code Input (deps: expo-blur, react-native-svg)
- `morphing-toolbar-plus-quick-menu` — Morphing Toolbar Plus Quick Menu (deps: @shopify/react-native-skia)
- `checkbox-spike-strikethrough-todo` — Checkbox Spike Strikethrough Todo (deps: expo-blur, react-native-svg)
- `draggable-tick-arc-score-gauge` — Draggable Tick Arc Score Gauge (deps: react-native-svg)
- `check-off-task-reorder-list` — Check-Off Task Reorder List (deps: react-native-svg)
- `thrown-card-stack-with-sheets-and-undo` — Thrown Card Stack with Sheets and Undo (deps: @shopify/react-native-skia, expo-linear-gradient, react-native-gesture-handler, react-native-reanimated, react-native-svg)
- `glowing-live-home-widgets` — Glowing Live Home Widgets (deps: react-native-svg)
- `ai-image-generate-and-dust-disintegrate` — AI Image Generate and Dust Disintegrate (deps: @shopify/react-native-skia, react-native-reanimated)

## When NOT to use Now In Code

- The project uses Flutter, SwiftUI, or Kotlin (only React Native / Expo and plain Web are provided).
- The user wants a full headless design system or uniform component kit with shared tokens across 50+ primitives; Now In Code pieces are standalone high-craft screens, interactions, and effects meant to be adapted.
