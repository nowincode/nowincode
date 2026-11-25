# Now In Code

**The UI you saved. Now in code.**

[Now In Code](https://nowincode.com) rebuilds the interface and motion designs people save on X, Dribbble and elsewhere as working code for React Native (Expo) and the web. Every piece ships both builds from one shared timing core, so the motion is identical on a phone and in a browser.

This repository holds the **10 free pieces**, MIT licensed. The full library has 204 pieces: [browse it with live previews](https://nowincode.com/library).

## The free pieces

| Piece | Type | Code | Inspired by | Extra dependencies |
|---|---|---|---|---|
| [Hold-to-Confirm Glow Fill Button](https://nowincode.com/library/hold-to-confirm-glow-fill-button) | Components | [source](pieces/hold-to-confirm-glow-fill-button) | [@a_cucos](https://x.com/a_cucos/status/2107894726628127140) | `@shopify/react-native-skia` `expo-haptics` `react-native-svg` |
| [Sticky Section Headers with Progressive Blur](https://nowincode.com/library/sticky-section-headers-with-progressive-blur) | Components | [source](pieces/sticky-section-headers-with-progressive-blur) | [@leon7hao](https://x.com/leon7hao/status/2120047269340946932) | `@react-native-masked-view/masked-view` `expo-blur` `expo-linear-gradient` `react-native-svg` |
| [Morphing Verification Code Input](https://nowincode.com/library/morphing-verification-code-input) | Components | [source](pieces/morphing-verification-code-input) | [@sucodeee](https://x.com/sucodeee/status/2107420636113191248) | `expo-blur` `react-native-svg` |
| [Morphing Toolbar Plus Quick Menu](https://nowincode.com/library/morphing-toolbar-plus-quick-menu) | Components | [source](pieces/morphing-toolbar-plus-quick-menu) | [@uiinspoo](https://x.com/uiinspoo/status/2113591752158482613) | `@shopify/react-native-skia` |
| [Checkbox Spike Strikethrough Todo](https://nowincode.com/library/checkbox-spike-strikethrough-todo) | Components | [source](pieces/checkbox-spike-strikethrough-todo) | [@barret_jessy](https://x.com/barret_jessy/status/2114756442804949307) | `expo-blur` `react-native-svg` |
| [Draggable Tick Arc Score Gauge](https://nowincode.com/library/draggable-tick-arc-score-gauge) | Components | [source](pieces/draggable-tick-arc-score-gauge) | [@cabralorenzo](https://x.com/cabralorenzo/status/2123723992452190252) | `react-native-svg` |
| [Check-Off Task Reorder List](https://nowincode.com/library/check-off-task-reorder-list) | Components | [source](pieces/check-off-task-reorder-list) | [@marten_maxxx](https://x.com/marten_maxxx/status/2113246307557200184) | `react-native-svg` |
| [Thrown Card Stack with Sheets and Undo](https://nowincode.com/library/thrown-card-stack-with-sheets-and-undo) | Components | [source](pieces/thrown-card-stack-with-sheets-and-undo) | [@tobiadonadon_](https://x.com/tobiadonadon_/status/2124633199443595342) | `@shopify/react-native-skia` `expo-linear-gradient` `react-native-gesture-handler` `react-native-reanimated` `react-native-svg` |
| [Glowing Live Home Widgets](https://nowincode.com/library/glowing-live-home-widgets) | Components | [source](pieces/glowing-live-home-widgets) | [@seanaiux](https://x.com/seanaiux/status/2114829924133728625) | `react-native-svg` |
| [AI Image Generate and Dust Disintegrate](https://nowincode.com/library/ai-image-generate-and-dust-disintegrate) | Interactions | [source](pieces/ai-image-generate-and-dust-disintegrate) | [@benchodev](https://x.com/benchodev/status/2122766724835823644) | `@shopify/react-native-skia` `react-native-reanimated` |

Each folder has `rn/` (React Native, Expo), `web/` (a self-contained browser build) and a README.

## Use one

Copy a folder from `pieces/` into your project, or let the CLI do it:

```sh
npx nowincode login
npx nowincode add hold-to-confirm-glow-fill-button
```

The CLI writes the React Native files to `components/<slug>/` and prints the `npx expo install` line for any extra dependencies. Add `--web` for the browser build. A free account is enough for these ten.

Coding agents can pull pieces directly through the MCP server at `https://nowincode.com/mcp`. See the [docs](https://nowincode.com/docs).

## The rest of the library

194 more pieces across screens and flows, onboarding and paywalls, components, interactions, data viz and effects are available with a [Now In Code plan](https://nowincode.com/pricing). New pieces are picked from what people vote for on the [feed](https://nowincode.com/feed).

## Credits and removal

Pieces are inspired by designs shared publicly by their authors, credited above and on each piece page. If one of them is yours and you want it changed or removed, use the [removal form](https://nowincode.com/removal) or write to support@nowincode.com. Requests are handled within three working days.

## License

MIT for everything in this repository. See [LICENSE](LICENSE). Bundled fonts keep their own open licenses (SIL OFL).
