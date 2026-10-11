# Native rewrite checkpoint

Updated 2026-10-04 (Asia/Taipei). Work is on `feat/native-apps`; changes are uncommitted.

## Implemented

The Quasar/Capacitor app has been replaced with Expo SDK 57 and React Native.
Shared feature logic uses `@expo/ui` controls backed by SwiftUI on iOS and
Jetpack Compose / Material on Android. Expo Router provides native tabs and
stacks. The original app identity is preserved.

Home, settings, about, timetable editing, calendar and task editing, category
management, restaurant map/list/favorites, school RSS and pins, weekly menus,
YouBike and Metro, partner links, souvenir store, and random-choice helper are
implemented. The tab bar is fixed at five tabs (今天, 課表, 行事曆, 美食,
校園); the other features live inside 美食 and 校園. The previous app's user
data is imported once on the first launch after the update (see below).

CI and contributor documentation now use Expo prebuild, native Gradle/Xcode
builds, and lint/type/test checks. No release was published.

## Redesign (2026-10-09)

On branch `redesign/fixed-tabs` (uncommitted). See docs/design/native-ui.md.

- Five fixed tabs (今天 · 課表 · 行事曆 · 美食 · 校園); 設定 is a sheet with
  關於 inside; 熱食部 sits in 美食, the rest in 校園.
- 今天: the 現在 card with the bell rail (kit `NowCard`), states from
  `features/home/now.ts`; school days, holidays and exams from the 行事曆
  (`features/todo/school-days.ts`); sections 今日, 午餐, 回家, 釘選.
- 課表: 上午 / 下午 with 連堂 merged, and a week grid (kit `TimetableGrid`).
- 行事曆: 假 / 考 day marks, long events dot their ends only, and a grade
  filter (on by default).
- 美食: nearest first with distances; links open a view and a menu day.
- iOS widget (expo-widgets 57.0.22, included by default; `ENABLE_WIDGETS=0` opts out locally).
- A period now ends at its bell (`getCurrentPeriod`), on 今天 and 課表 alike.

Verified on the iPhone Air simulator (iOS, the app's real data, the clock set
from the debugger for each state): the tabs, the 設定 sheet, 校園, 美食's
switch and links, every 現在 card state in light and dark mode, 課表's day and
week views, 行事曆's marks.

Then the screens were brought to the design (the CK APP Redesign PDF):
large titles with a subtitle line on iOS, prominent section headers, view
switches in the navigation bar, the welcome screen (你是哪一班？), week strips
with dates (`DayStrip`), period badges in soft subject colours, 連堂 as one
tall cell in the week grid, 行事曆's 接下來 and a pushed 待辦 list, 美食's
chips, map card and 營業中 · 至 13:30 lines, 校園's unread dots and tags, the
✓ done button and green switches, and the widget's rail and 接下來 list.
Checked on the iPhone Air simulator (light and dark, both widget sizes on the
Home Screen) and on the CK_Pixel emulator as a separate `.codexverify` build
(every tab, the welcome flow, 設定). The 熱食部 menu is published as an image,
so the dishes the design lists in text appear in the image only.

A design review against Apple's HIG followed (2026-10-10), and its findings
were fixed: the subtitle under the large title in the primary colour; no class
assumed when the welcome screen is skipped (`DEFAULT_CLASS` is ""); every text
size a system text style, with the geometry around it scaling (`layoutScale`)
and the grid, headers and card adapting at the accessibility sizes; checking a
todo off reversible until the day ends; one control for the calendar's grade
filter; the toolbar `space` item so text buttons sit apart from chevrons; the
widget's rail kinds told apart by shape. The week grid was then restyled after
the printed timetable: one coloured cell per period with the subject's full
name, colours by subject family unless the user chose one (`subject-colors.ts`).
課表 then became one table for the whole week: the 日 / 週 switch, the week
strip and the day list went, and every subject got a colour of its own (a
wheel of 22 hues, each subject at the slot its name hashes to or the next
free one, anchored on the class's own timetable so its subjects keep their
colours through edits up to 22 subjects); a colour the user picks for a slot
still wins. A
review of that change added a ring on the cell in session (none on a day
off), a free period's note in its cell, the bell times, rotation and note in
each cell's spoken label, a list of the week at the accessibility text sizes,
and the coming week's subject in the editor's preview at the weekend. The
顏色 pickers (a slot's, an event category's) show each colour as a dot before
its name: inline rows on iOS, whose menus would tint every dot, and the
dropdown on Android.

熱食部 was then rebuilt to the PDF: the day's dishes listed natively (項次,
dish, price; the rice dishes, then the rest), `8 道` in the header, and the
printed image a link away. The dishes come from `menus/<Monday>.json`, which
the Data repo's update_menu.py has to start writing next to the images (a
patch for its scripts is prepared, not yet applied); until it does, every
week falls back to the image, as before.

The image fallback now uses a fitted paper card immediately below the weekday
strip. It crops the known printed template to its eight dish rows and measures
the space above the native tab bar, so the whole picture fits at ordinary
portrait text sizes. The card opens the original in the native in-app browser;
large accessibility text keeps the full-width picture and scrolling. Loading
keeps the card's frame, named calendar holidays offer the next school day,
and native dish-list cards omit the repeated date/count header.

## Verification

- TypeScript and lint pass.
- 308 domain and HTTP regression tests pass across 38 suites.
- Expo Doctor passes 21/21 checks with CocoaPods available on PATH.
- Android and iOS Hermes production bundles export successfully.
- The fitted 熱食部 picture shows all eight dishes above the native tab bar
  on iPhone Air and CK_Pixel. Native taps open the in-app browser; drags and
  pull-to-refresh retain the fitted frame without opening it. The named
  holiday state and next-school-day action pass on iOS.
- Dark mode and large-text scrolling pass on both platforms. A temporary
  JSON fixture shows all eight native dish rows; the original cache values
  and device text/theme settings were restored after verification.
- Android debug APK builds; a separate `.codexverify` application was installed
  so the emulator's existing app and personal data remain untouched.
- iOS simulator build passes with scene lifecycle enabled. The rebuilt app
  launches on iOS 27 and renders its native home screen.
- Runtime screen and editing checks are in progress. Android checks identified
  and fixed selected-segment contrast and native text-entry synchronization.
- HTTP deadlines and caller cancellation now cover response-body reading;
  stalled-download and cancellation regression tests pass.
- Legacy import: transform, merge, status and multi-launch session tests pass
  under Jest (real stores over in-memory storage). Not yet run on a device.

## Continue here

1. Finish Android editing/persistence and iOS screen checks; fix runtime issues.
2. Final lint, typecheck, all 37 tests, and both production bundle exports pass
   after shared-field/HTTP changes. Rerun affected checks if runtime fixes follow.
3. Update this checkpoint with final verification evidence and remaining items.

Generated `ios/` and `android/` folders are ignored. Install dependencies before
running `pod install` and compiling; Yarn can remove Expo SQLite's generated
headers. A fresh DerivedData directory resolved a stale SQLite compiler module
that had imported the system header while Expo's generated header was absent.

Temporary native logs/screenshots and bundles are under `/private/tmp`.
The local Metro server is on port 8081. Android's verification build connects
through `adb reverse` and its own `debug_http_host=localhost:8081` preference.

## Legacy user-data import

The previous app kept everything in its WebView's localStorage: the whole Vuex
state as JSON under `store`, and the class again under `userClass`. That
storage belongs to its origin, `capacitor://localhost` on iOS and
`https://localhost` on Android (`http://localhost` for Capacitor 5 and earlier,
read only when the https origin is empty). This app's stores use SQLite, so
keeping the bundle ID alone does not carry the data over.
`src/features/legacy-import/` copies it once:

- `_layout.tsx` calls `startLegacyImport()` before the first render. Until
  the import has finished, each launch counts an attempt before it starts (at
  most three, so a crash cannot loop) and mounts a hidden react-native-webview
  per origin. The splash screen stays up with no screen mounted for at most
  4.5 s, so neither the user nor the automatic timetable load can write to the
  stores first. If no answer has come by then, the app shows and the reader
  keeps going unseen for up to 30 s in total. A late answer is merged the same
  way, so a slow device (Chromium starting for the first time) still imports
  on that launch.
- Each WebView loads a tiny page with `source={{ html, baseUrl: origin }}`
  (WKWebView `loadHTMLString:baseURL:` / Android `loadDataWithBaseURL`) in the
  default persistent web storage, and posts back `self.origin`, `store` and
  `userClass`. The native behaviour this relies on is documented in
  `legacy-importer.tsx`.
- `transform.ts` maps the Vuex state to each store, defensively: UTC-serialised
  event/todo dates become local `YYYY-MM-DD`, numeric ids become strings,
  timetable cells keep notes, colours (label, Quasar option object or fill),
  單/雙週 rotations and overrides, and junk or duplicates are dropped. The
  news cache and the toolbar (the tab bar is fixed now) are not carried over.
- `merge.ts` applies it without losing anything made in this app: values and
  lists still at their defaults are replaced, other lists are combined by
  id/name/title, and the timetable is replaced only if the user has not edited
  it here (edits are tracked in the status record while the import is owed).
  The old app's 恢復已讀訊息 marker (2010-01-01) counts as nothing read.
- The status lives under `ck.legacy-import`, outside the stores, so
  Settings' 重設個人資料與設定 does not trigger another import. While the
  import is still owed, that reset (every store back to its initial state in
  one task) ends it as `reset`, so the old data does not come back after the
  user cleared everything. `abandonLegacyImport()` does the same if called
  directly. Outcomes: `imported`, `empty` (nothing saved, as on a fresh
  install), `gave-up` or `reset`. `imported` and `empty` also record
  `reader: 1`. A timeout or unreadable origin leaves the import pending for
  the next launch.

## Before a store release

Legacy user-data import is implemented but **not yet validated on a device**.
Install a real previous store release (a Capacitor 7 build, e.g. 3.4.0) on
Android and on iOS, add data in every area (edited and 單/雙週 cells with notes
and colours, a changed class, events and todos, custom categories, pins,
favourites, YouBike and Metro stations and home widgets), then
install this build over it and check that everything arrives. The emulator's older installed app
is NativeScript and was kept intact, so it cannot serve for this.

The iOS path is the main risk: it depends on WebKit giving a page loaded with
`baseURL` `capacitor://localhost` that tuple origin (and so the previous app's
localStorage) without a registered `capacitor` scheme handler. The reader can
only catch two kinds of failure: an opaque origin (`self.origin` is `"null"`)
or an exception. These are retried on two more launches and then recorded as
`gave-up`. If WebKit gives the page the right origin but a different, empty
storage (another data store or partition), the read looks exactly like a
fresh install and is recorded as `empty` on the first launch. A fallback
(such as reading WebKit's storage files directly) would then be needed before
release. It can use the recorded `reader` version to re-run the `empty`
outcomes that version 1 produced.

Android maps require `GOOGLE_MAPS_API_KEY`; without it the food list remains
usable and the map picker explains the limitation. Live Metro requires the
existing `METRO_API_USER` / `METRO_API_PASS` configuration. Store signing and
uploads require the documented CI credentials and have not been exercised here.

Codex usage-limit resets are managed by the host. This checkpoint preserves
progress but does not itself schedule an automatic restart.
