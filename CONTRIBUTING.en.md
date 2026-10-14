# Contributing Guide

**Language / 語言:** [中文](CONTRIBUTING.md)｜English (this page)

Read the [README](README.en.md) for the React Native architecture, configuration, and current release limitations.

## Local development

Use Node.js 24.12.0+ and Yarn Classic. From the repository root:

```bash
yarn install --frozen-lockfile
cp .env.example .env.local
yarn android --device
# On macOS with Xcode and CocoaPods, yarn ios --device is also available
```

For Android Studio, SDK/JDK setup, and CocoaPods troubleshooting on macOS, follow the [README development instructions](README.en.md#development). `yarn start` serves JavaScript to an installed native debug build; rebuild after adding native dependencies.

Android debug installs use **CK APP Dev** (`org.capacitor.quasar.ckapp.dev`) with separate data from the store app. For an existing generated `android/`, run `npx expo prebuild --platform android --no-install` once to apply the debug identity. Release and iOS identities remain unchanged.

After changing native dependencies or configuration, regenerate with `npx expo prebuild --clean`. Do not commit `ios/` or `android/`. Persist native changes in `app.config.ts` or config plugins.

## Feature changes

1. Keep screens, hooks, and pure behavior in `src/features/<feature>/`. Write rules such as timing and states as pure functions outside the screen, so they can be tested.
2. Put routes in `src/app/`. The five tabs are fixed (`TABS` in `src/features/registry.ts`).
3. Add new features inside an existing tab: daily ones in the tab they belong to, the rest in Campus (`src/app/(tabs)/campus/` and `CAMPUS_SCREENS`).
4. Use Zustand actions in `src/store/` with `src/lib/storage.ts` for persistence. Do not directly mutate arrays in screens.
5. Build screens from the `@/ui` kit only: a `ListScreen` holds only `Section`s, and a `Section` holds rows and blocks. Do not put React Native or `@expo/ui` views inside them; show React Native content (maps, images) through `Embedded`. For a new component or prop, define it in `src/ui/types.ts` first, then implement it in `src/ui/ios/` (SwiftUI) and `src/ui/android/` (Compose), and add it to the [design spec](docs/design/native-ui.md)'s mapping table. `src/ui/kit.tsx` re-exports the Android kit for TypeScript; Metro selects the native platform implementation.
6. Put navigation-bar buttons, menus and view switches (such as Food's 熱食部 / 附近) in `HeaderActions` (`src/components/header-actions`). Add icons to `src/components/icons.ts` with both an SF Symbol and a Material Symbol. The line under a tab's title is `ListScreen`'s `subtitle`.

### Design rules

The interface follows the [design spec](docs/design/native-ui.md). When changing a screen:

- The inverted triangle only ever means "now"; the full CK navy is only for Today's 現在 card.
- Use semantic system colors for text, backgrounds and separators, so light/dark mode and Increase Contrast work. Timetable colors come only from `src/features/schedule/cell-colors.ts` (the seven the user can pick) and `subject-colors.ts` (each subject's own), with text on fill at least 4.5:1. Text always uses a system text style (`textStyle`), never a fixed size (`font({ size })` does not scale with Dynamic Type).
- A status always has text, not color alone, such as the dot beside 營業中.
- Times, prices and counts use monospaced digits.
- Things stay where they are; only their content changes with the time.
- Every tappable element has an accessibility label, and selection is announced by VoiceOver / TalkBack.

### The 現在 card and the widget

Class, break and day-off states live in `src/features/home/now.ts`; the iOS widget's timeline (`src/widgets/now-timeline.ts`) is built from the same states, so update both sets of tests when changing either. The widget layout (`src/widgets/now-widget.tsx`) is a `'widget'` function and may use only `@expo/ui`'s SwiftUI views, modifiers and its own arguments. A modifier the extension does not support (`fixedSize`, for one) blanks the widget without any error, so after a layout change build with `ENABLE_WIDGETS=1` and add the widget to the simulator's Home Screen to check it.

Calendar keys are local `YYYY-MM-DD`, handled through `src/lib/dates.ts`. Do not generate calendar dates or menu Mondays with `toISOString()`. Remote data needs validation, failure states, and a cache policy. Pause polling when it is unnecessary.

## Data changes

| Data                        | Location                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Class timetables            | Data repo `schedules/gaoyi_schedules.json`, `gaoer_schedules.json`, `gaosan_schedules.json`                                    |
| Restaurants                 | Data repo `restaurantData.json`: names, coordinates, and opening hours                                                         |
| School calendar             | Data repo `calendar/<term>.json`, currently `calendar/115-1.json`; source/schema are in `src/features/todo/school-calendar.ts` |
| Cafeteria menus             | Data repo `menus/<Monday-date>.json` (the week's dishes) and `menus/<Monday-date>_<1-to-5>.png` (daily images)                 |
| Static Metro stations/lines | `src/features/transport/metro-lines.ts`                                                                                        |

The source is [CKApp-Dev/Data](https://github.com/CKApp-Dev/Data). Check the feature validators before changing payloads. Historical scripts in `tools/` may not produce the current schema; inspect their output before using it.

## Validation and pull requests

Work on a branch and open a PR. Before submitting:

```bash
yarn typecheck
yarn test --runInBand
yarn lint
```

Cover changes to dates, parsing, or state rules with meaningful regression tests. Place pure tests near their feature as `*.test.ts` and import `@jest/globals`. The current Jest suite does not require native UI startup.

Verify affected flows on Android and iOS, including native inputs, sheets/dialogs, toolbar navigation, maps, offline behavior, and persistence after restart. For interface changes, look once on the iOS simulator and once on the Android emulator, in dark mode and at a larger text size, and update the design spec when a layout changes. Describe the problem, resulting behavior, validation, and untested limitations in the PR, with screenshots from both platforms for interface changes.

## Versions and releases

Local versions come from `package.json`. `app.config.ts` accepts `APP_VERSION` and `BUILD_NUMBER`. Do not edit generated Gradle/Xcode version values by hand.

Both a `vX.Y.Z` tag and a manually dispatched build workflow build, sign, and upload to Google Play internal / TestFlight. Tags require numeric `major.minor.patch`; manual runs use the package version. The workflow run number becomes the build number. Ordinary branch pushes and `[deploy]` commit prefixes do not trigger releases.

Keep signing credentials in GitHub Secrets and local API configuration in `.env.local`. Never commit private keys, provisioning profiles, or real API credentials.

**Legacy Capacitor WebView localStorage is imported on first launch by `src/features/legacy-import`.** When you change a store's shape or defaults, update that folder's transform/merge logic and tests too. Before release, validate the import by upgrading from a real previous build on Android and iOS.

## Contact

ckappofficial@gmail.com｜[Instagram](https://www.instagram.com/ckappofficial/)
