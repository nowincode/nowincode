---
name: nowincode
description: Find, inspect, and install React Native (Expo) and plain Web UI/motion pieces from Now In Code using Remote MCP, CLI, or the Markdown catalog. Use when the user asks to add a Now In Code piece, avoid generic AI UI slop, or build an animated RN/Expo or Web interaction, paywall, onboarding flow, chart, or shader effect.
---

# Now In Code

Now In Code (`https://nowincode.com`) is a growing library of trending UI and motion designs from X and Dribbble, rebuilt from scratch as working **React Native (Expo SDK 54, TypeScript)** and **plain Web (HTML, CSS, JS)** code, with timing and easing constants written at the top of each file.

## Workflow

### Option A: Remote MCP (preferred if connected)

If the user has connected the Now In Code remote MCP server (`https://nowincode.com/mcp`):

1. Call `list_tags` or `search_pieces` (no login required) with keywords, `tag`, `type`, or `form` to find exact slugs.
2. Call `get_piece` to inspect metadata, tags, and credit.
3. Call `get_source` with `slug` and `target` (`"rn"`, `"web"`, or `"all"`) to fetch the full watermarked files, npm dependencies, and integration prompt directly into context.

### Option B: Markdown catalog + CLI (works everywhere)

1. **Discover exact slugs (never guess)**:
   - Full index: `https://nowincode.com/llms.txt`
   - Browse by tag (Markdown): `https://nowincode.com/tags/<tag>.md` (e.g. `bottom-sheet`, `tab-bar`, `spring`, `shader`, `paywall`, `card-stack`)
   - Piece spec (Markdown): `https://nowincode.com/library/<slug>.md`
2. **Install with CLI**:

```sh
# First time only (free account works for the 10 free pieces; Pro/Lifetime unlocks the full library):
npx nowincode login

# Install React Native (Expo) source into components/<slug>/:
npx nowincode add <slug>

# Or install the matching plain web build:
npx nowincode add <slug> --web
```

After `npx nowincode add <slug>` finishes, run the `npx expo install ...` command it prints if the piece has extra dependencies (such as `@shopify/react-native-skia`, `react-native-reanimated`, `expo-blur`, `expo-haptics`, or `react-native-svg`).

### Adapt to the user's app

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
