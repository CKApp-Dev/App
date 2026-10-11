# CK App Refactoring Plan

## Context

CK App is a Quasar/Vue 3 campus mobile app (~8,651 lines) for Taipei Jianguo High School with ~2,080 downloads. It was built rapidly and has accumulated technical debt: hardcoded credentials, oversized components (up to 1,746 lines), production console logs (including passwords), dead login/Firebase feature code, and zero test coverage. The goal is a clean, maintainable codebase without breaking existing functionality.

**Stack:** Vue 3 · Quasar 2 · Vuex 4 · Firebase 10 · Axios · Leaflet · Capacitor (Android/iOS)

---

## Phase 0 — Preparation

- Create a `refactor/cleanup` git branch; commit each phase separately
- Move `CK_app/src/tools/` (Python scripts, Excel files) to top-level `tools/` — they inflate the Vite asset graph
- Document a manual smoke-test checklist covering: YouBike, Metro, Food map, Calendar, Todos, Home widgets, Settings, Menu page, News feed

---

## Phase 1 — Security (highest priority)

### 1-A. Firebase config: eliminate duplicate initialization

**Problem:** `firebaseConfig` literal is copy-pasted in 3 files. `boot/firebase.js` is not in Quasar's boot array, so `LoginPage.vue` and `SettingsPage.vue` each call `initializeApp()` independently — sometimes 3× per page — creating duplicate Firebase app instances.

**Fix:**
1. Add `"firebase"` to `boot: [...]` in `quasar.config.js`
2. Keep `boot/firebase.js` as the single source — it already exports `db` and `auth`
3. In `LoginPage.vue` and `SettingsPage.vue`: remove local `initializeApp`/`getFirestore` calls; `import { db } from 'src/boot/firebase'`
4. Add comment in `boot/firebase.js` noting Firebase Web API keys are intentionally public per Firebase's own docs

**Files:** `quasar.config.js`, `src/boot/firebase.js`, `src/pages/LoginPage.vue`, `src/pages/SettingsPage.vue`

### 1-B. Metro SOAP credentials — done, see PR #14

**Problem:** The Metro API username and password were hardcoded as plain text in 3 XML template strings inside `TransportPage.vue`.

**Fix implemented in PR #14:** rather than a `src/config/metroApi.js` constants file (which would still commit the value to source, just in a different file), the credential now reads from `process.env.METRO_API_USER`/`METRO_API_PASS` — a gitignored `.env.local` locally, GitHub Actions secrets in CI. **Note:** the account owner has decided not to rotate the actual credential value, accepting that it's already known from git history and that a client-only app embeds whatever value is configured into the shipped bundle regardless of rotation.

**Files:** `src/pages/TransportPage.vue` (3 occurrences), `quasar.config.js`, `.env.example`, `.github/workflows/build_android.yml`, `.github/workflows/build_ios.yml`

---

## Phase 2 — Quick Wins (low-risk, high-value)

### 2-A. Remove `storeWatcherPlugin`
In `src/store/index.js`, the debug plugin does `store.watch` on the entire state with `{ deep: true }`, calling `console.log` + `JSON.parse(JSON.stringify(...))` on every mutation. This logs the full state (including plaintext passwords from the account module) in production. Delete the entire plugin and remove it from `plugins: [...]`; keep `localStoragePlugin`.

### 2-B. Fix duplicate Vuex mutation
`SET_SHOW_TODO` is defined twice in `src/store/modules/todo.js` (lines 42 and 60). Remove the second definition.

### 2-C. Remove all production `console.log` calls
Key locations (keep `console.error`):

| File | Notes |
|------|-------|
| `store/index.js` | Already cleared by 2-A; also lines 59–60 in `CLEAR_DATA` |
| `store/modules/account.js` | Lines 9, 13, 17, 30, 33 — logs email/password |
| `store/modules/youbike.js` | Lines 26, 45 |
| `services/newsService.js` | Line 45 |
| `utils/xmlUtils.js` | Line 9 |
| `pages/SettingsPage.vue` | Lines 338, 452, 727 |
| `pages/TransportPage.vue` | Lines 1017, 1020, 1265 |
| `pages/MenuPage.vue` | Line 108 |

### 2-D. Remove unused dependencies — done, see Phase 2 PR
- `pinia` — installed, never imported anywhere
- `vuex-persistedstate` — replaced by hand-rolled `localStoragePlugin.js`

**Correction:** this list originally also named `timeago.js` as unused. That was wrong — it's genuinely imported and called in `src/App.vue` and `src/pages/NewsPage.vue` for relative timestamp formatting. It was NOT removed.

Ran `yarn remove pinia vuex-persistedstate` (not `npm uninstall` — this is a yarn-only project; running npm here would create a conflicting `package-lock.json`).

---

## Phase 3 — Remove Dead Login/Account Feature

The login feature was abandoned due to Firebase latency. Safe to fully remove.

**Steps:**
1. **`SettingsPage.vue`:** Remove the "管理員登入" card, import/export dialogs, and all orphaned setup vars: `isLoggedIn`, `userName`, `userEmail`, `userAccount`, `password`, `email`, `userRef`, `saveData`, `logout`, `goToLoginPage`, backup/import functions
2. **Router:** Remove `{ path: "/login", ... }` from `src/router/routes.js`
3. **Delete** `src/pages/LoginPage.vue`
4. **`HomePage.vue`:** Remove `isLogin` computed (used only in a commented-out block)
5. **`store/index.js`:** Remove `account` module import; delete `src/store/modules/account.js`

**Verify:** No 404s; settings page works (3 toggle dialogs, clear data); no console errors about missing getters.

---

## Phase 4 — Component Splitting

Commit each extraction separately. Target: page orchestrators ≤350 lines.

### 4-A. `TransportPage.vue` (1746 lines → ~350 lines)

New directory: `src/components/transport/`

| New File | Contents |
|----------|----------|
| `YoubikeSection.vue` | Station card grid, 4 YouBike dialogs, all YouBike refs/methods |
| `MetroSection.vue` | Metro station sections, crowdedness legend, add-station dialog, all metro refs/methods |
| `src/composables/useYoubike.js` | `Station` class, `districtOptionsTPC/NTC`, `calculateDistance`, `deg2rad`, `parseTimestamp`, `timeAgo` |

`TransportPage.vue` retains only: FAB menu toggle (`showMenu`, `toggleMenu`) and renders the two section components.

Polling (`setInterval`) moves into each section independently — they fetch different APIs anyway.

### 4-B. `TodoPage.vue` (1393 lines → ~200 lines)

**Also fixes:** This component illegally mixes Options API (`data()`, `computed`, `methods`) with Composition API `setup()`. After splitting, the page moves to pure `<script setup>`.

New directory: `src/components/todo/`

| New File | Props | Emits |
|----------|-------|-------|
| `CalendarView.vue` | `events`, `todos`, `schoolEvents`, `currentView` | `edit-event` |
| `TodoListView.vue` | `todos`, `todoCategories`, `currentView` | `todo-checked` |
| `EventDialog.vue` | `isEditing`, `eventCategories`, `initialEvent` | `save`, `delete`, `cancel` |
| `TodoDialog.vue` | `todoCategories` | `save`, `cancel` |

Remove entirely: dead `fetchAndParseSchoolEvents` function and the commented-out `ICAL` import.

### 4-C. `SettingsPage.vue` (~600 lines after Phase 3 → ~300 lines)

Extract:
- `HomeWidgetSettings.vue` — the 3 toggle items
- `ToolbarCustomiser.vue` — toolbar item reorder + visibility toggles

### 4-D. `FoodPage.vue` (684 lines → ~300 lines)

New composable: `src/composables/useRestaurantHours.js` — exports `getMarkerIcon`, `isOpen`, `isWithinMinutes`, `getCurrentDay`, `translateDays` (all pure, no Vue dependency — testable).

Extract: `RestaurantSidebar.vue`, `RestaurantList.vue`, `MapLegend.vue`

---

## Phase 5 — Hygiene

### Remove i18n infrastructure (recommended)
The skeleton exists (`src/boot/i18n.js`, `src/i18n/`, `vue-i18n` dep) but the UI is 100% hardcoded Chinese. Remove boot registration, delete the directory, uninstall `vue-i18n` and `@intlify/vite-plugin-vue-i18n`, remove the vitePlugins block from `quasar.config.js`.

### Version alignment
`package.json` says `3.0.1`; actual released version is `3.1`. Update all three locations to `3.1.0`:
- `package.json` → `"version": "3.1.0"`
- `src-capacitor/android/app/build.gradle` → `versionName`
- `src-capacitor/ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION`

### Vuex cleanup
- `CLEAR_DATA` in `store/index.js` has a dead `Object.assign` before it's immediately overwritten — simplify the reset loop
- After Phase 3, the `plugins` array has only `localStoragePlugin` — remove the array wrapper if preferred

---

## Phase 6 — Bug Fixes

### 6-A. MenuPage date off-by-one
`getWeekStartDate()` calls `monday.toISOString().split("T")[0]` which returns UTC date. At UTC+8, midnight Monday in Taipei is still Sunday in UTC, so the wrong date is returned.

**Fix:** Replace with a local-date formatter:
```js
const pad = (n) => String(n).padStart(2, '0')
return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
```
The server-side duplicate-file workaround can then be retired.

**File:** `src/pages/MenuPage.vue`

### 6-B. FoodPage time overflow (24:00+ closing times)
`isWithinMinutes` breaks when closing time is e.g. `25:00` (1 AM next day) — `25*60=1500` is always greater than any sub-24h current time.

**Fix:** When parsed closing minutes exceed 1440, compare `currentMinutes + 1440` against the closing time. Extract this fix into `useRestaurantHours.js` (Phase 4-D).

**File:** `src/pages/FoodPage.vue` → `src/composables/useRestaurantHours.js`

---

## Phase 7 — Test Infrastructure

Install `vitest` (integrates with Vite). Update `package.json` test script to `"vitest run"`.

Write unit tests for the pure composables extracted in Phase 4:
- `src/composables/useRestaurantHours.js`: `isOpen`, `isWithinMinutes`
- `src/composables/useYoubike.js`: `calculateDistance`, `parseTimestamp`
- `MenuPage.vue`'s `getWeekStartDate` after Phase 6-A fix

These have zero Vue/Firebase dependencies and are straightforward to test.

---

## Verification (end-to-end after all phases)

1. Run `quasar dev` — app loads without console errors
2. YouBike: add station, edit nickname, delete station; nearest-stations map dialog opens
3. Metro: arrivals update every ~10s; add/delete station
4. Food: map markers appear; sidebar opens; restaurant list dialog opens
5. Calendar: create multi-day event; dots appear on all days; edit from day popup
6. Todo: add with category; filter in list view; check off
7. Home: widgets toggle in Settings and appear/disappear on Home page
8. Settings: toolbar reorder persists on reload; clear data resets everything
9. Menu: correct week image loads on Monday; no duplicate-file dependency
10. News: news feed loads from school XML feed

---

## Priority Order Summary

| Phase | Risk | Effort |
|-------|------|--------|
| 0 — Prep & branch | None | Low |
| 1-A — Firebase dedup | Low | Low |
| 1-B — Metro credentials | Low | Low |
| 2 — console.log, dup mutation, unused deps | Very low | Low |
| 3 — Remove login/account dead code | Medium | Medium |
| 4 — Component splitting (A→B→C→D) | Medium | High |
| 5 — i18n removal, version alignment, Vuex cleanup | Low | Low |
| 6 — Bug fixes (date, time overflow) | Low | Low |
| 7 — Test infrastructure | None | Medium |
