# CK APP

**Language / 語言:** [中文](README.md)｜English (this page)

CK APP was created in 2024 by CK students Kimi and Diego to help students manage schedules and tasks, check transport, and find nearby food.

The app now uses **React Native, TypeScript, and Expo SDK 57**. Android interactive controls use Material 3 / Jetpack Compose; iOS uses SwiftUI controls and native navigation. Screen logic and layout are shared through React Native. The current package version is **4.0.1**; `app.config.ts` resolves the app version and build number.

The interface follows the school bell: the emblem's inverted triangle only ever points at "now", and the full CK navy is reserved for the 現在 card at the top of Today. On iOS the tabs use the system large title with one line under it (the date, class or week), and Food's 熱食部 / 附近 switch sits in the navigation bar. See the [design spec](docs/design/native-ui.md) for each screen's layout and the component mapping.

## Features

There are five fixed tabs:

| Tab               | Behavior                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today (今天)      | The 現在 card (bell rail, countdown to the bell, days off and exam days), today's tasks and events, lunch, the commute, and pinned school news; the class button opens Settings                                                                |
| Timetable (課表)  | One table for the whole week (a cell per period, every subject in its own color, the current period and days off marked); custom subjects, odd/even-week rotation, notes, colors, and re-import                                                |
| Calendar (行事曆) | Month grid (days-off and exam marks, grade filter), the day's events and tasks, what comes next, and the full task list with categories                                                                                                        |
| Food (美食)       | Cafeteria (熱食部): the day's dishes and prices (rice dishes first) with a dated week strip and days off, and the original menu image. Nearby (附近): map, open-now / favorites filters, nicknames and distances, favorites, and a random pick |
| Campus (校園)     | School news (unread, tags, pins, search), transport (YouBike and Metro), partner shops, souvenirs, and the decision helper                                                                                                                     |

| Other        | Behavior                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| First launch | 你是哪一班？ ("Which class are you in?"): pick a class by grade, or look around first                                                              |
| Settings     | Class, what Today shows, the calendar's grade filter, local data reset, and About                                                                  |
| Widget (iOS) | The 現在 widget: small and medium Home Screen sizes (bell rail, countdown, the rest of the day) and the Lock Screen; included in iOS builds |

## Architecture and data

| Path                            | Purpose                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app/`                      | Expo Router routes, native stacks, and feature tabs                                                |
| `src/features/`                 | Feature screens, data transforms, and hooks                                                        |
| `src/features/registry.ts`      | The five fixed tabs and the screens inside Campus                                                  |
| `src/ui/`                       | The native UI kit: one contract (`types.ts`), implemented in SwiftUI on iOS and Compose on Android |
| `src/components/`               | Navigation-bar buttons, the tab bar, and the icon table                                            |
| `src/widgets/`                  | The iOS 現在 widget's layout and timeline                                                          |
| `src/theme/`, `src/navigation/` | Platform colors, dark mode, and native navigation                                                  |
| `src/store/`                    | Zustand state persisted through Expo SQLite                                                        |
| `src/lib/`                      | HTTP timeouts, validated remote data/cache, date and storage helpers                               |
| `assets/`                       | App icons, splash images, and other static assets                                                  |
| `app.config.ts`, `plugins/`     | App identity, versions, native configuration, environment inputs, and config plugins               |
| `.github/workflows/`            | Native builds, signing, and testing-track uploads                                                  |
| `tools/`, `docs/`               | Data utilities, the design spec, and historical decision records                                   |

Timetables, restaurants, the school calendar, and cafeteria menus come from the [Data repository](https://github.com/CKApp-Dev/Data). JSON is validated before caching; failed refreshes keep the last saved content. Menus come as one `menus/<Monday>.json` per week (each day's dishes and prices) plus a daily image named after the local Monday and weekday, such as `menus/2026-10-05_4.png`; a week without the JSON shows the image.

Native apps request upstream services directly. School news refreshes every two minutes; news and transport polling pause according to screen focus / app foreground state. The tabs are fixed: Today, Timetable, Calendar, Food and Campus. The cafeteria menu is inside Food; school news, transport, partner shops, souvenirs and the helper are inside Campus. A new install opens on 你是哪一班？ first; an import from the previous app that brings a class skips it.

Classes, breaks and days off are worked out from the timetable's bell times and the school calendar (`src/features/home/now.ts`, `src/features/todo/school-days.ts`): a period ends at its bell, and days off and exam days listed in the calendar replace that day's lessons. The cafeteria's dishes come from JSON the Data repo generates from the school's menu spreadsheet; the app does not read them out of the image.

The settings reset restores personal stores/settings and clears in-memory query data. It retains remote JSON caches, cached menu images, and souvenir website data.

`ios/` and `android/` are generated, ignored directories. Make persistent native changes in `app.config.ts` or a config plugin, then regenerate. See [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/).

`expo-build-properties` enables `ios.enableSceneSupport` so generated projects adopt the scene lifecycle for Xcode 27 / iOS 27. Regenerate and rebuild after changing it; see [Expo's scene lifecycle guidance](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md).

## Development

Install Node.js 24.12.0+ and Yarn Classic. Android needs Android Studio / SDK and Java 21. iOS needs macOS, Xcode, and CocoaPods. Current SDK 57 native defaults are Android API 24+ and iOS 16.4+.

```bash
git clone https://github.com/CK-APP-Org/CK_app.git
cd CK_app
yarn install --frozen-lockfile
cp .env.example .env.local
```

Fill in `.env.local`, then run from the repository root:

```bash
yarn android --device # Select an emulator/device, build, and launch Android
yarn ios --device     # Select a simulator/device, build, and launch iOS
yarn start         # Start Metro for an installed development build
```

After changing native dependencies or app configuration, regenerate with `npx expo prebuild --clean`. This overwrites manual changes inside generated native directories. Verify maps and native controls in the native app.

### Android Studio on macOS

The command is `yarn android` (spelled **android**). In Android Studio's Device Manager, create and start an emulator, then run `yarn android --device` from the repository root. A connected Android phone with USB debugging enabled also works. Check that `adb devices` lists the device before building. See [Expo's Android Studio setup](https://docs.expo.dev/workflow/android-studio-emulator/).

Android debug builds install as **CK APP Dev** (`org.capacitor.quasar.ckapp.dev`) alongside the store app, with separate data. This avoids `INSTALL_FAILED_UPDATE_INCOMPATIBLE` when the installed store app and local debug APK have different signing keys. If `android/` already exists, apply this configuration once before rebuilding:

```bash
npx expo prebuild --platform android --no-install
yarn android --device
```

Release builds keep `org.capacitor.quasar.ckapp`; iOS keeps its existing identity. To build Android release locally, use `npx expo run:android --variant release` so Expo launches the release application ID. Upgrading the original app and testing legacy data import still require a build signed with its original key. See [Expo's variant launch options](https://docs.expo.dev/guides/local-app-development/#local-builds-with-android-product-flavors).

If the Android Maps key restricts package names and signing certificates, also allow the Dev package and its debug certificate. See [Expo's app variant configuration](https://docs.expo.dev/build-reference/variants/).

If the terminal cannot find the SDK, add these settings to `~/.zshrc` using the SDK path shown in Android Studio, then open a new terminal:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
```

To build in Android Studio itself, run `npx expo prebuild --platform android`, open the generated `android/` folder in Android Studio, select JDK 21 as the Gradle JDK, and run the `app` configuration. Keep `yarn start` running in another terminal for the debug app's JavaScript. Regenerate and rebuild when native dependencies or app configuration change.

### iOS prerequisites and CocoaPods

Android Studio supplies Android tooling; iOS builds use Xcode. Open Xcode once to complete setup, select its Command Line Tools under **Settings → Locations**, and install an iOS simulator runtime under **Settings → Components**. Then use `yarn ios --device` to choose a simulator or connected iPhone. See [Expo's iOS Simulator setup](https://docs.expo.dev/workflow/ios-simulator/).

Check `pod --version` before building. If CocoaPods is already installed as a user gem but `pod` is missing from `PATH`, add its executable directory to `~/.zshrc` and open a new terminal:

```bash
export PATH="$(ruby -r rubygems -e 'puts Gem.user_dir')/bin:$PATH"
```

If CocoaPods is not installed, follow [CocoaPods setup](https://guides.cocoapods.org/using/getting-started.html), or use `brew install cocoapods` when [Homebrew](https://formulae.brew.sh/formula/cocoapods) is available. A `spawn brew ENOENT` error means Expo's fallback installer could not find Homebrew; first check the existing CocoaPods installation and `PATH`.

`yarn start` starts Metro and does not compile native modules. After adding a native dependency, build the app again; an installed binary that lacks that module cannot gain it through JavaScript reloads. See [Expo's local build workflow](https://docs.expo.dev/guides/local-app-development/).

If iOS reports missing `NSLocation*UsageDescription` keys, regenerate the native project before rebuilding. The `expo-location` plugin in `app.config.ts` supplies `NSLocationWhenInUseUsageDescription` for finding nearby YouBike and Metro stations; an existing `ios/` project can still contain an older `Info.plist`.

```bash
npx expo prebuild --platform ios
yarn ios --device
```

Reloading Metro cannot apply permission descriptions to an installed app. See [Expo's iOS permissions guide](https://docs.expo.dev/guides/permissions/#ios).

If `getCurrentPositionAsync` reports `LocationUnavailable` / `kCLErrorDomain error 0` in the simulator, supply a simulated location and retry **尋找附近站點**. For a test location near CK:

```bash
xcrun simctl location booted set 25.031204,121.515966
```

The simulator needs location data in addition to permission. See [Expo's simulator location setup](https://docs.expo.dev/versions/v57.0.0/sdk/location/#ios-simulator).

### iPhone widget

iOS builds include the 現在 widget by default. If an older build does not show CK APP in the widget gallery, regenerate the iOS project and reinstall a native build:

```bash
npx expo prebuild --platform ios
yarn ios --device
```

Open CK APP once after installing, then long-press the Home Screen, choose **Edit → Add Widget**, and search for **CK APP**. The widget supports small and medium Home Screen sizes, plus inline and rectangular Lock Screen sizes. Expo Go cannot install this extension; a JavaScript reload cannot add it to an existing binary. See [Expo Widgets configuration](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/).

For a physical iPhone, set `IOS_TEAM_ID` to your Apple Developer team or select the same team for **CKAPP** and **ExpoWidgetsTarget** in Xcode. Both targets use the App Group `group.org.capacitor.quasar.ckapp`. Set `ENABLE_WIDGETS=0` only for local builds whose signing setup cannot use App Groups; those builds have no iPhone widget.

| Environment variable               | Purpose                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `METRO_API_USER`, `METRO_API_PASS` | Taipei Metro API credentials; ask a maintainer                                                                                                                                                           |
| `GOOGLE_MAPS_API_KEY`              | Maps SDK for Android key; without it the app shows a notice while restaurant/station lists remain available. iOS uses Apple Maps                                                                         |
| `ENABLE_WIDGETS`                   | iOS widgets are enabled by default; `0` opts out locally. Requires an App Group and separate app/extension provisioning profiles for device builds |
| `IOS_TEAM_ID`                      | Optional Apple Developer team for both iOS targets in local device builds; CI uses the release team |
| `APP_VERSION`                      | Optional override of the package version; CI derives it from the tag/package                                                                                                                             |
| `BUILD_NUMBER`                     | Optional local override, default `1`; CI uses the workflow run number                                                                                                                                    |

Do not commit `.env.local`. Metro credentials and the Maps key are bundled into the app and are not server-side secrets. Protecting credentials requires a backend.

## Validation

```bash
yarn typecheck
yarn test --runInBand
yarn lint
```

Jest covers pure date, timetable, 現在 card state, calendar, restaurant-hours, RSS, transport, and widget-timeline behavior. Also verify input, tab navigation, sheets, maps, offline caching, light and dark mode, and persistence after restarting on both platforms. Check interface changes once on the iOS simulator and once on the Android emulator; every kit component needs both a SwiftUI and a Compose implementation (see the [design spec](docs/design/native-ui.md)).

## Releases and signing

The [Android workflow](.github/workflows/build_android.yml) and [iOS workflow](.github/workflows/build_ios.yml) run on `vX.Y.Z` tags or manual dispatch. They check lint/types/tests, generate native projects, build, and sign. **Both triggers upload to Google Play internal or TestFlight.** Tags additionally attach artifacts to a GitHub Release. Ordinary branch pushes and a `[deploy]` commit prefix do not trigger these workflows.

Tag versions must be numeric `major.minor.patch`. Manual runs use `package.json`. Each workflow's run number becomes `BUILD_NUMBER`; maintainers must ensure it exceeds the existing store build. The app identity remains `org.capacitor.quasar.ckapp`.

Gradle signs APK/AAB files with the existing `PLAY_SIGNING_KEY`, `PLAY_SIGNING_KEY_ALIAS`, `PLAY_SIGNING_KEY_STORE_PASSWORD`, and `PLAY_SIGNING_KEY_PASSWORD` secrets. `SERVICE_ACCOUNT_JSON` uploads to Play. iOS uses `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, and `KEYCHAIN_PASSWORD`, retaining profile `Github Actions` and team `FJX3SGU9AL`. TestFlight retains secret `APPSTORE_API_PRIVATE_KEY` and variables `APPSTORE_ISSUER_ID` / `APPSTORE_API_KEY_ID`. Builds also require the API configuration above. See [Expo release builds](https://docs.expo.dev/guides/local-app-production/) for native signing guidance.

The iOS release also requires `BUILD_WIDGET_PROVISION_PROFILE_BASE64`, an App Store distribution profile for `org.capacitor.quasar.ckapp.ExpoWidgetsTarget`. Register `group.org.capacitor.quasar.ckapp` and enable it on both the app and widget identifiers, then regenerate both profiles. Update the existing app profile secret as well; it must retain production Push Notifications. CI validates both profiles, signs both targets, and exports the embedded widget with the app.

## Required before shipping updates

**The legacy data import needs on-device validation.** New Zustand state uses Expo SQLite, separate from the previous Capacitor WebView's localStorage. On first launch, `src/features/legacy-import` reads the previous app's tasks, events, timetable edits, class, favorites, pins, followed stations, and settings through a hidden WebView, converts them, and merges them in without overwriting data created in the new app (see [docs/native-rewrite-progress.md](docs/native-rewrite-progress.md)). Before shipping to existing users, install a real previous release (for example 3.4.0) on Android and iOS, create data, upgrade, and confirm everything arrives.

First-time requests without connectivity or a saved cache show an error/empty state. Store signing, the legacy data import, and native device behavior still require full release validation.

## Contributing and contact

Read the [Contributing Guide](CONTRIBUTING.en.md). Official email: ckappofficial@gmail.com; [Instagram](https://www.instagram.com/ckappofficial/).
