# Native UI redesign: SwiftUI on iOS, Material 3 on Android

Status: design spec for the 2026-10 redesign of CK APP's React Native screens.

The Today screen also includes **最新公告** immediately after the 現在 card.
It uses the existing Section, Row, Notice, Loading and TextBlock components on
all platforms. Show up to three published announcements, their Taipei release
dates, and an explicit 未讀 label; 全部 opens the latest 50 announcements.
Tapping a row or system notification opens the same full-text detail screen,
marks it read, and offers the optional HTTPS link. Loading, empty, offline and
withdrawn-announcement states remain inside the native list. Settings includes
公告通知 with an explicit permission control and a link to OS settings when
permission is denied. Publication scheduling and admin tools live outside the
mobile UI.

## Why

The first React Native build stacked React Native cards full of full-width
buttons ("編輯待辦", "上移 課表", "移除站點" …) on both platforms. It looked the
same everywhere and felt native nowhere. The redesign keeps every feature and
all copy but renders each screen with the platform's own components:

- **iOS**: SwiftUI through `@expo/ui/swift-ui`: inset-grouped `List`s,
  `Section` headers and footers, `LabeledContent`, menu and segmented
  `Picker`s, `Toggle`s, compact `DatePicker`s, swipe actions, context menus,
  `refreshable`, SF Symbols, and navigation-bar buttons instead of in-content
  buttons.
- **Android**: Jetpack Compose Material 3 through `@expo/ui/jetpack-compose`:
  `LazyColumn` of section cards with `ListItem`s, `PullToRefreshBox`,
  extended FAB for the primary action, filter chips, segmented buttons,
  outlined text fields, exposed dropdown menus, the Material date picker
  dialog, overflow menus, Material Symbols, and the CK navy seed palette.

## Architecture

```
src/ui/
  types.ts                 the kit contract (shared by both platforms)
  index.ts                 re-exports `./kit` (platform-resolved) and types
  kit.ios.tsx              SwiftUI implementation
  kit.android.tsx          Compose Material 3 implementation
  kit.tsx                  TypeScript entry — re-exports `./kit.android`
  labels.ts                shared spoken labels (e.g. 「<row>」的更多選項)
  use-synced-text.ts       shared helper: native text state <-> React state
  ios/use-snap-back.ts     SwiftUI pickers always show `value`
```

Screens are written **once** against the kit (`import { ListScreen, Section,
Row, … } from '@/ui'`). Each kit component renders real native views on each
platform, with the platform idioms built in (e.g. `Row.actions` become swipe
actions + a context menu on iOS and an overflow menu on Android). A screen may
still add `screen.ios.tsx` / `screen.android.tsx` when the platforms need a
genuinely different layout, but sharing is the default.

Metro selects `kit.ios.tsx` or `kit.android.tsx` for native builds. The
`kit.tsx` entry lets TypeScript resolve the shared exports through the Android
implementation; it has no separate UI implementation.

Row states the kits share:

- `disabled` on `Row` / `ToggleRow` turns off the row's own tap or switch and
  dims it, nothing more: `actions` (and a `Row`'s `toggle`) stay available,
  so a feature greyed out at a limit can still be moved. An action is greyed
  on its own with `RowAction.disabled` (greyed menu item; left out of iOS
  swipe buttons). On a disabled iOS row a full swipe only reveals the swipe
  buttons instead of firing the edge one.
- Android's overflow button is spoken as `「<title>」的更多選項`, so TalkBack can
  tell rows apart. iOS has no visible
  trigger: the actions live in the swipe actions and long-press menu of a row
  that VoiceOver reads by its title.
- `ListScreen.refreshing` shows refresh progress the screen started itself
  (a header 重新整理 button). Android shows pull to refresh's
  own indicator; SwiftUI cannot start `refreshable`'s spinner from code, so
  iOS shows a spinner row above the first section while no pull is running.
- `MonthCalendar` draws at most `CALENDAR_CELL_INDICATORS` (3, from
  `@/ui/types`) indicators per day on every platform; callers pick which ones
  (行事曆 keeps a slot for the todo square).

Rules for kit children: a `ListScreen` contains only `Section`s. A `Section`
contains rows (`Row`,
`CheckRow`, `ToggleRow`, `PickerRow`, `TextFieldRow`, `DateRow`, `ButtonRow`,
`TextBlock`, `TileGrid`, `MonthCalendar`, `Embedded`, `FilterChips`, …).
A lone segmented picker (view switcher), filter chips and full empty states go
in a `plain` Section ("Section (no title)" below means a plain section).
Inline elements (`MetricPills`, `CrowdBar`) only go in `Row.footer`. Never mix
raw `@expo/ui` or React Native views into kit trees — add a kit component.

Shared logic stays in hooks/pure modules under `src/features/*` (already
unit-tested). Platform kit files must not contain feature logic.

### Navigation chrome

- The tab bar is fixed: 今天 · 課表 · 行事曆 · 美食 · 校園 (`TABS` in
  `src/features/registry.ts`; SF Symbols sun.max, tablecells, calendar,
  fork.knife, building.columns; Material Symbols light_mode, table_chart,
  calendar_month, restaurant, account_balance). 熱食部 lives in 美食; 校網,
  交通, 建北特約, 校慶紀念品 and 選擇障礙小幫手 are pushed in 校園's stack. Nothing
  is user-configurable, so no section moves or disappears, and no More tab.
- 設定 is a modal route with its own stack (`src/app/settings/`), opened from
  今天's class button (`201`) in the header; 關於 pushes inside it.
- A new install opens on 你是哪一班？ (`/welcome`, full screen): pick the
  grade (segmented) and the class (`ChoiceGrid`), 開始使用, or 先看看，之後再選.
  `settings.welcomed` remembers it; a legacy import that brings a class sets
  it too.
- Tab roots and pushed screens keep expo-router's native stack header and
  native tabs. On iOS the tab roots have the system large title (titles in
  the label colour, buttons in the tint), collapsing into the bar as the list
  scrolls; UIKit finds the SwiftUI List's scroll view. The line under it (date,
  class, week) is `ListScreen.subtitle`, drawn as a row-less section header so
  it sits close under the title, in the primary label colour (it is the
  screen's main fact; `secondaryLabel` is 3.3:1 on the grouped background). Android keeps the top app bar title and shows
  the subtitle as the list's first line.
- Screen-level actions go in the header via `HeaderActions` (iOS
  `Stack.Toolbar` buttons/menus; Android top-app-bar icon buttons and an
  overflow `DropdownMenu`). A screen's view switch is a `segmented` header item
  (美食 熱食部 / 附近): a SwiftUI segmented `Picker` in a
  `Stack.Toolbar.View` on iOS, Material segmented buttons in the top app bar
  on Android. Android sets both header sides on every render, so a side a view
  leaves empty is cleared. A `space` item is a fixed gap that, on iOS 26, also
  ends the shared glass background: a text button (今天, 本週) sits apart from
  the symbol buttons beside it, so the chevrons pair as a stepper and the text
  does not read as their label (`Stack.Toolbar.Spacer`; a `Box` on Android).
  Primary "add" actions additionally show as an Android extended FAB
  (`ListScreen.fab`); iOS ignores `fab`.
- A header menu may hold one level of submenus (`{ kind: 'submenu' }`, e.g.
  課表's 選擇班級): a nested `Stack.Toolbar.Menu` (UIMenu child) on iOS; on
  Android an item with a trailing arrow that swaps the open dropdown's items
  for the submenu's, under a back item. Selected actions get a checkmark
  (`isOn` on iOS, a leading check on Android, where every item of a menu keeps
  the leading slot once one has an icon or check, so labels line up).
- Disabled header icons and menu triggers are greyed on both platforms (iOS
  by UIKit; Android in Material's disabled colour, onSurface at 38%).
- Search uses the native header search bar (`Stack.SearchBar`), not an
  in-content text field; with a large title it sits under the title.
- Editors (`/todo-editor`, `/event-editor`, `/schedule-editor`, new
  `/categories`, `/youbike-picker`, `/metro-picker`, `/youbike-rename`,
  `/restaurant`) are modal routes: iOS page sheet with 取消 (left) and a
  prominent 儲存 (right) in the navigation bar, or the tinted ✓ (完成) where
  nothing is saved; Android full-screen modal with a close icon (left) and a
  儲存 text button (right). Destructive actions are a `ButtonRow
  role="destructive"` in the last section.
- Confirmations keep `Alert.alert` (native UIAlertController / Material
  dialog).

### Theme

- Brand: CK navy `#03328d` (`BRAND`). iOS hosts get `seedColor` = tint (lifted
  `#8EAEFF` in dark mode, as in `use-palette.ios.ts`); Android hosts get
  `seedColor={BRAND}` so Compose builds a SchemeTonalSpot palette that matches
  `usePalette()`.
- Status colours (open/closing/opening/closed, YouBike availability, Metro
  crowding, timetable cell colours, event category colours) are data and stay
  as they are; dark-mode variants come from the existing helpers.
- Dynamic Type / font scaling: use text styles (SwiftUI `font({ textStyle })`,
  Compose `typography`) instead of fixed sizes.
- The 現在 card is the one CK-navy block in the app (`NOW_CARD` in
  `src/theme/brand.ts`: `#03328D`, `#17377F` in dark mode). White text is
  11.4:1 / 11.1:1, 78% white 7.5:1 / 7.4:1, and the rail's parts still to
  come are 45% white (3.45:1). Everything else keeps system colours; the tint
  marks interaction and "now" (the 現在 badge, today's column and date).

### Accessibility

Every icon-only control has a label; rows read as one element with title,
subtitle and state; selected/checked states are exposed; colour is never the
only signal (status text accompanies dots; crowding has a text summary; the
period in session is ringed as well as tinted).

## Kit components (see `src/ui/types.ts` for the exact props)

| Component | iOS (SwiftUI) | Android (Compose M3) |
|---|---|---|
| `ListScreen` | `Host{flex:1}` › `List` + `listStyle('insetGrouped')` + `refreshable`; `subtitle` → a row-less first section's header under the large title | `Host{flex:1}` › `PullToRefreshBox` › `LazyColumn` (16dp gutters, 16dp spacing, safe-area bottom padding) + optional `ExtendedFloatingActionButton` overlay; `subtitle` → first line |
| `Section` | `Section title footer`; a header row (`HStack`) for `titleBadge` (tint), trailing `detail` and an `action` link; `prominent` → `headerProminence('increased')`, lined up with the large title; `footerAction` → a link under the footer; `plain` → clear row backgrounds | header `Row`: title (titleSmall, primary; `prominent` → titleLarge bold), badge, detail, `TextButton` action + `Card` (surfaceContainerLow) of rows with dividers + footer `Text` (bodySmall) and `TextButton`; `plain` → rows without the card |
| `Row` | `Button` (plain) / static `HStack`: leading SF Symbol, dot or square (`dotShape`), or `mark` (考 glyph, date, list number, period badge in the subject's fill/ink, dashed for 空堂); tags over the title, `titleAside` (nickname), subtitle with a status dot, `note`; `strong` / `emphasized` titles; trailing detail (`detailProminent` bold)/badge/accessory; `SwipeActions` + `ContextMenu` for `actions`; leading swipe for `toggle`, or a trailing heart-style button with `toggle.button` | `ListItem` with Headline/Supporting/Overline/Leading/Trailing slots (tags in the overline, the mark or dot leading), `clickable`, `containerColor` for `background`; trailing `IconButton` for `toggle`, overflow `DropdownMenu` for `actions` |
| `CheckRow` | Reminders-style circle / `checkmark.circle.fill` button + title; tap row body to edit | `ListItem` with leading `Checkbox` |
| `ToggleRow` | `Toggle` | `ListItem` + trailing `Switch` |
| `PickerRow` (menu) | `Picker` + `pickerStyle('menu')`; options with colour dots `pickerStyle('inline')`, a row each with a coloured `circle.fill` (a menu would draw every dot in the tint) | `ExposedDropdownMenuBox` + read-only `OutlinedTextField`; colour dots before the options and the value |
| `PickerRow` (segmented) | `Picker` + `pickerStyle('segmented')`, labels hidden | `SingleChoiceSegmentedButtonRow` |
| `TextFieldRow` | `TextField` (vertical axis when multiline) | `OutlinedTextField` with label |
| `DateRow` | `DatePicker displayedComponents={['date']}` (compact) | `ListItem` showing the date › `DatePickerDialog` |
| `ButtonRow` | `Button` (role, systemImage); `prominent` → `borderedProminent` | `ListItem` clickable in primary/error colour; `prominent` → filled `Button` |
| `TextBlock` | `Text`; `size: 'title'` → large title, `brandMark` → the 倒三角 above it | `Text` bodyMedium; `title` → headlineLarge |
| `EmptyState` | `ContentUnavailableView` on iOS 17+, `VStack` fallback on 16.x | centred `Column`: 48dp icon, titleMedium, bodyMedium, `TextButton` |
| `Notice` | `Label` with warning/info symbol + text, optional button | tonal `Card` (errorContainer / secondaryContainer) |
| `Loading` | `ProgressView` + label | `LinearProgressIndicator`/`CircularProgressIndicator` + label |
| `FilterChips` | horizontal `ScrollView` of capsule `Button`s (bordered / borderedProminent) | `FlowRow` of `FilterChip`s |
| `TileGrid` | `Grid` of tiles (`Image` + `Text`) | rows of clickable `Card` tiles (`Icon` + `Text`) |
| `ChoiceGrid` | `Grid` of plain buttons, the selected one on the tint | rows of `Surface` buttons, the selected one primary |
| `DayStrip` | `HStack` of plain buttons: weekday over the date, ▼ over today, the selected date in a tint `Circle`, a day off red with its caption | `Row` of `Surface`s, the same marks |
| `MonthCalendar` | `Grid` 7×6 day cells with dots (or a 假 / 考 mark), weekday header (the screen pages months from its header) | `Column` of `Row`s, `Box` cells (`weight(1f)`), dots (or the mark) |
| `MetricPills` | `HStack` of `Label`s with coloured symbols | `Row` of `AssistChip`-like pills |
| `CrowdBar` | `HStack` of `Capsule`s | `Row` of rounded `Box`es |
| `Embedded` | `RNHostView` in a row; `fit="screen"` uses native geometry and the tab safe area; optional native Button overlay | `RNHostView`; `fit="screen"` measures to the Host's bottom; optional native Material button overlay |
| `NowCard` | a List row on the navy (`listRowBackground`); the rail is a `ZStack` of shapes placed by width (`onGeometryChange` on a clear full-width layer) | navy `Card`; the rail is `Row`s of `Box`es weighted by minutes |
| `TimetableGrid` | one `VStack` of plain-button cells per weekday, one cell per period, row labels beside (the start time left out from the xxxLarge size up), lunch a plain centred label; a lesson cell in its fill/ink with the full subject (up to three lines) and a `note.text` mark when it has a note (a free period's note in the plain fill), the period in session ringed (`strokeBorder` in the tint), a 空堂 nothing but a tap target, a day off dimmed | the same as weighted `Column`s of `Box` cells (`background`, `Icon` for the note, `border` in primary for the period in session, a name past three lines ellipsized) |

## Screens

All copy stays as today unless noted. Pull-to-refresh where the screen loads
remote data.

### 今天 (Today)
- Header: the class (`201`, or 班級 before one is chosen), opening the 設定
  sheet. Subtitle `10月7日 星期三 · 第 6 週 · 雙週` (the week and parity on
  school days only).
- A plain Section holding the kit `NowCard`: what is happening at this minute
  (`src/features/home/now.ts`, unit-tested). States: before school (first
  class, `22 分鐘後上課` within the hour else `08:10 上課`, `16:00 放學`), in
  class (`第三節 · 10:10–11:00`, subject, note or `連堂到 10:00`, `23 分鐘後下課`,
  `下一節 英語文 11:10` / 今天最後一節), 下課 (the next class, `6 分鐘後上課`),
  午餐 (`46 分鐘後上課`, the first afternoon class), after school (今天的課上完了
  with the time, 放學了, tomorrow's first class), an exam day (今天考試,
  `第 2 天，共 2 天`, 祝考試順利！), a day off (今天不用上課 with the weekday, the
  holiday's name from the 行事曆 or 週末 / 寒假, `連假到 10月11日` for a long
  weekend, a 下次上課 line). A period ends at its bell. School days draw the
  bell rail: each period a bar as long as the period (filling as it passes; a
  空堂 an outline), breaks as gaps, lunch dotted, the ▼ (the emblem's inverted
  triangle) at now. Before and after school the card adds the first YouBike
  and Metro line (and the 回家 section hides). Tapping opens what it is about
  (課表, 熱食部, 交通, 行事曆).
- Sections with prominent headers, each switchable in 設定:
  - "今日" — today's `CheckRow` todos (`待辦 · 作業`), the day's events with a
    square swatch (`學校 · 學務處`; the user's, then the school's for the
    grade; days off, exams and the middle days of events longer than a week
    are left out), the next exam within three weeks with the 考 mark and a bold
    `還有 6 天`; empty → 今天沒有待辦或活動。
  - "午餐" — 熱食部 (`今天的菜單`, after lunch the next school day's, opening
    美食 on that day) and `附近 41 間營業中` with the nearest open places by
    nickname (林乾 · 建豆 …), opening 美食 › 附近. The menu is an image, so the
    dishes are not listed here.
  - "回家" — a `Row` per followed YouBike station (`借 30 · 還 19`) and Metro
    station (`往松山 3 分 · 往新店 6 分`), opening 交通. Polled every minute
    only before and after school (the Taipei feed is ~1 MB); otherwise fetched
    on focus when older than five minutes.
  - "釘選的校網消息" — `Row` per pin (title, date subtitle, external
    accessory) opening the link; `ButtonRow` 查看校網.

### 課表 (Schedule)
- One table for the whole week. Header: a menu with a 選擇班級 submenu (every
  class, the current one checked; choosing one confirms first when it would
  replace a timetable, and leaves the check unchanged when declined) and
  重新匯入課表, once the timetables have loaded. Subtitle `201 · 第 6 週 · 雙週`.
  At the weekend the table shows the coming week (and its parity).
- The kit `TimetableGrid` on the background, like the printed timetable: a
  column per weekday (the date under the weekday; today under ▼; days off
  from the 行事曆 red with 放假 and dimmed), a row per period with its numeral
  and start time (until the bell times load, the timetable's own periods
  without times), `午休 12:00–13:00` between the morning and the afternoon,
  one coloured cell per period with the subject's full name (a 連堂 is two
  cells of the same colour), a small note mark on a cell with a note (a free
  period with a note shows the note in the plain fill, as 今天 does), and
  nothing drawn for a 空堂 (it still takes a tap). The period in session has
  its row label tinted and its cell ringed in the tint (never on a day off).
  Each cell's spoken label gives the weekday and period, the bell times, the
  subject, the rotation (`單週：A　雙週：B`) and the note. Tapping a cell
  opens the editor; the footer is the edit hint.
- At the accessibility text sizes (the kit's `useAccessibilityTextSize`: iOS
  AX1 and up, Android a font scale of 1.5 and up), where five columns cannot
  hold the size chosen, the same week is a list: a Section per weekday
  (`星期一`, its date, 今天 or the day off's name), a `Row` per period with
  its badge in the subject's colour (dashed for a 空堂), the bell times, the
  rotation and the note, the period in session emphasised with a 現在 badge.
- Colours: every subject in a timetable has a colour of its own.
  `subject-colors.ts` puts each on a wheel of 22 hues, alternately lighter
  and darker (ink on fill 5.2:1 or more in light and dark; the closest two
  slots measure CIEDE2000 6.5 light, 5.8 dark), at the slot its name hashes
  to, or the next free one when another name has it, so the 14 to 20
  subjects of a class all differ and a subject keeps one colour wherever it
  sits in the week. The class's own (bundled) timetable anchors the wheel:
  its subjects keep their slots through edits, and a subject the user types
  in takes a free one (which can change when the free slots do: another
  typed-in subject, or a class subject cleared everywhere or put back). Past
  22 subjects the wheel widens and every colour moves once. With no class,
  before the timetables load, or when they no longer include the class,
  every subject is placed by name alone. A subject's colour holds within one
  timetable only: in another class it can be quite another colour, wherever
  the names placed before it pushed it. The user's own colour for a slot (one of
  the seven in `cell-colors.ts`, each a soft fill with a deep ink, 4.5:1 or
  more) wins; the picker calls the subject's colour 預設（依科目）. The Quasar
  fills are kept only to recognise imported colours.
- Loading/error: `Loading` / `Notice` blocks.

### 編輯課程 (/schedule-editor, modal)
- Header 取消 / 儲存.
- Section "科目": either `TextFieldRow` 科目, or (rotation on) 單週科目 /
  雙週科目; `ToggleRow` 單雙週輪替 (from phase 1 model).
- Section "備註": multiline `TextFieldRow`.
- Section "顏色": `PickerRow` with 預設（依科目） and the seven colours, each
  with a round dot in its hue before the name (預設's is the subject's own
  colour, a dashed ring for a 空堂; the seven are the system hues the
  swatches soften): on iOS a row each in the section, the chosen one checked,
  on Android a dropdown. Then a preview `Row` of the slot as 課表 will draw it
  once saved: the displayed week's subject (the coming week's at the weekend),
  in its colour on the timetable with the draft in place.

### 行事曆 (Todo)
- Header: ‹ › (previous and next month) then a gap and 今天 on the left; the
  `+` menu (新增待辦 / 新增活動) on the right; Android FAB 新增待辦. Subtitle
  `2026年10月 · 115 學年度第 1 學期`.
- A Section with the kit `MonthCalendar`. Days off listed in the 行事曆 are red
  with 假, the grade's exam days carry 考 (`CalendarCell.mark`, drawn instead
  of the dots); events are dots, todos squares. School events longer than a
  week dot only their first and last day. The grade filter (on by default;
  the setting is also in 設定) has one control, the calendar's footer, which
  reads both ways: `已隱藏 6 則只給高一、高三的活動。` with 全部顯示 while it hides
  something, `顯示所有年級的活動。` with 只顯示和高二有關的 while it is off and
  would hide something, nothing otherwise.
- A Section titled with the selected day (`10月7日 星期三 · 今天`): events as
  `Row`s (square swatch, title, `學校 · 學務處 · 全天` or the category and the
  days; school events show 暫定/約略 and have no chevron; user events open the
  editor; actions 編輯/刪除) and todos as `CheckRow`s (`待辦 · 作業`). Empty →
  `TextBlock secondary` 這一天沒有活動或待辦。
- Checking a todo off is reversible: it stays listed, checked, with
  `已完成 · 作業`, until the end of that local day (`Todo.completedAt`,
  `todo-state.ts`), so a mis-tap is undone by tapping again; the next day it
  is hidden and pruned. Open todos list before completed ones; 接下來, the
  calendar's squares and every count show open todos only. The same holds on
  今天's 今日 and in the 待辦 list.
- "接下來": what starts in the next two weeks after the selected day (up to
  five), each with the date mark (`四` over `8`).
- `Row` 所有待辦 (`N 項`) → 待辦 (`/todo/list`, pushed): menu `PickerRow`
  顯示類別 (counts) and `ButtonRow` 管理待辦類別 (→ `/categories?kind=todo`);
  one Section per date group (title = date + weekday; overdue groups get
  footer 已過期); `CheckRow` per todo (tap edits; actions 刪除). Footer
  勾選待辦即完成並移除。

### 待辦 / 活動 editors (modal)
- Header 取消 / 儲存 (disabled until valid).
- 待辦: Section `TextFieldRow` 待辦標題; Section `ToggleRow` 指定日期 +
  `DateRow` 日期; Section menu `PickerRow` 待辦類別 + `ButtonRow`
  管理待辦類別 (→ `/categories?kind=todo`); Section destructive 刪除待辦.
- 活動: Section 活動標題; Section `DateRow` 起始日期 / 結束日期 (min =
  start; error `Notice` 結束日期不能早於起始日期。); Section 活動類別 picker
  + 管理活動類別 (→ `/categories?kind=event`); Section destructive 刪除活動.
  School events: read-only rows + footer 學校活動僅供查看，無法修改。

### 類別管理 (/categories?kind=todo|event, modal, new)
- Header 完成.
- Section "活動類別"/"待辦類別": `Row` per category (event: colour dot),
  actions 刪除 (with the same Alert copy; events keep ≥1 category).
- Section "新增類別": `TextFieldRow` 新類別名稱, (event) colour `PickerRow`, each colour with its dot
  + `TextFieldRow` 自訂色碼 (#RRGGBB), `ButtonRow` 新增類別. Footers keep the
  existing hints.

### 交通 (Transport)
- Header: refresh icon (greyed while a refresh runs, with progress shown via
  `ListScreen.refreshing`); `+` menu (YouBike 站點 / 捷運車站); Android FAB
  新增站點 opens the same choice (menu on the header is enough; FAB → YouBike
  picker).
- Section "YouBike 站點" (footer: 約每 10 秒更新 · 站點更新 HH:MM:SS): one
  `Row` per followed station: title nickname, subtitle `城市 · 站名`,
  footer `MetricPills` 可借 N / 可還 N with availability colours, status
  text when loading/error/no data; actions 修改暱稱 (→ `/youbike-rename`) and
  移除站點 (destructive). Empty → `EmptyState` 尚未加入站點… with action.
- Section "捷運車站" (footer: crowding legend + 到站資訊更新 time): per station
  a `Row` header (title station, subtitle line names with line-colour dots)
  followed by one `Row` per train: title `往 X`, detail countdown, leading
  line-colour dot, footer `CrowdBar` (accessibility summary); actions 移除車站.
  Not configured → `Notice` 捷運即時到站資訊暫未啟用。你仍可管理常用車站。
- `/youbike-picker` (modal): Header 完成. Segmented 搜尋站點 / 附近九站;
  search mode: segmented 城市 + `Stack.SearchBar` (搜尋站名或行政區); result
  `Row`s (title, area subtitle, `MetricPills`, trailing 加入 / 已加入 via
  `toggle` or checkmark accessory, tap adds). Nearby mode: `Embedded` map
  (existing `StationMap`) + numbered result rows with distance.
- `/metro-picker` (modal): Header 完成. Segmented line picker (BL/BR/R/G/O/Y…
  as today) + `Stack.SearchBar`; station `Row`s with checkmark when added;
  tap toggles add (removal stays on the main screen).
- `/youbike-rename?city&sna` (modal): `TextFieldRow` 暱稱, Header 取消/儲存.

### 美食 (Food)
- The tab holds two screens switched by the segmented 熱食部 / 附近 in the
  header (`src/features/food/tab.tsx`); 熱食部 is first. Each keeps its own
  header actions and search. Links pass `view` (`menu` / `nearby`) and, for
  the menu, `date`. Below: 附近.
- Header: the switch and 隨機選擇 (dice). `Stack.SearchBar`
  搜尋餐廳或綽號，例如「林乾」. Subtitle `附近 · 12:14 · 86 間營業中`.
- `FilterChips` 營業中 / 我的最愛 (both platforms), then the `Embedded`
  `RestaurantMap` card (≈ 40% of the screen height) where maps are available.
- List: Section `由近到遠` (detail 距離從學校算起): `Row` per restaurant —
  title name, nickname or branch beside it (`titleAside`), subtitle with the
  status dot `營業中 · 至 13:30 · 140 m` (快打烊 · 13:00, 快開門 · 17:00,
  休息中 · 明天 06:00; `statusLine`), the favourite heart as a trailing button
  (red when on), tap → `/restaurant?name=`. Nearest first, straight-line from
  the east gate (`CK_COORDINATE`).
- `/restaurant?name=` (modal): Section header block (name, status), Section
  actions (加入/移除最愛, 在地圖開啟位置, 餐廳網站), Section "營業時間": `Row`
  per day (title 星期一, detail hours; today emphasized with badge 今天).
  Random choice opens this route for the chosen restaurant.

### 校網 (News)
- Header: menu 已讀所有訊息 / 恢復已讀訊息 / 重新整理. `Stack.SearchBar`
  搜尋消息.
- Section (no title): segmented 未讀 / 已釘選 / 已讀 / 全部.
- Section `{n} 則消息` (footer 最後更新：…): `Row` per item: title (3 lines),
  subtitle timestamp, overline 已釘選 when pinned, `toggle` pin, tap opens the
  article (external accessory), actions 開啟公告 / 分享 (iOS `ShareLink` not
  needed — use `Share.share`) / 釘選.
- "顯示更多" `ButtonRow`. Errors → `Notice` with 重試.
- 重新整理 / 重試 progress is a labelled `Loading` row in the status section
  (in place of the notice), not `ListScreen.refreshing`, so there is one
  indicator, not two.

### 熱食部 (Menu, inside 美食)
- Header: the 熱食部 / 附近 switch; ‹ › then a gap and 本週 on the left (iOS)
  or in a menu beside the switch (Android, where the top app bar has no room
  for both). Subtitle `熱食部 · 10月5日–9日`.
- `DayStrip` of the week (days off from 行事曆 marked 放假). The default is
  today, or Monday at weekends; 本週 restores that selection. Week paging
  announces the range for screen readers.
- The menu starts close below the strip (`Section tight`: 12pt on iOS17+,
  normal 16dp spacing on Android), without a repeated date/count header.
- A week without `menus/<Monday>.json` shows a paper card (`#F8F9FA`).
  `Embedded fit="screen"` measures its resting top and the visible list's
  bottom above the tab bar, fitting the whole picture into that space.
  Known 420×1000 template images (including proportional larger renders)
  show rows 120–758: all eight dishes, without the repeated date band or
  blank tail. Other image shapes display whole. The card centres the picture
  on matching paper; dark mode dims both together by 20%, and Android light
  mode adds a 1dp separator outline.
- The whole loaded card opens the original through `openWebsite` (native
  in-app browser with zoom). It is one native button with the spoken date,
  image label and hint; the hosted picture takes no touches or accessibility
  focus. Loading uses the same card frame, paper, spinner and busy label.
  There is no separate browser row in picture mode.
- Picture text keeps a minimum height of
  `ceil(638 × max(11, 12 × fontScale) / 28)`, capped at 638pt/dp. If the room
  is smaller, or an accessibility text size is selected, the full-width
  picture scrolls rather than shrinking further. The resting position is
  latched so ordinary scrolling and pull-to-refresh do not resize it.
- Once the week's JSON is available, two tight cards show native `Row`s:
  rice dishes 1–5, then noodles and sets 6–8. Each has its 項次 `index` mark,
  dish name and prominent price; the first row also reads the date and dish
  count. `ButtonRow` 查看原始菜單圖片 follows. The small SE can scroll this
  native list; ordinary larger portrait phones show all eight dishes.
- A day without dishes shows 這天沒有菜單 or the calendar's day-off name.
  In picture mode only a named calendar holiday suppresses the image request;
  inferred term breaks do not hide historical menus. A day off offers the
  next school day's menu. Failure shows 這一天的菜單尚未公布… with
  重新讀取菜單. A JSON404 immediately falls back to the picture; pull refresh
  reloads whichever is shown and retains the old picture while loading.

### 校園 (Campus)
- Header: search (opens 校網, which has the search bar).
- Section "校網" (prominent, `N 則未讀` badge, 全部 → 校網): the three newest
  unread announcements, then pinned ones: unread with a navy dot and a bold
  title, the title's leading 【轉知】-style labels as tags (`newsTags`),
  subtitle `10月8日 · 最新消息` (`· 已釘選`), opening the article. A failed
  feed says so in the footer with 重試. Polls like 校網 while focused.
- Section "交通": `Row` YouBike 與捷運 with the first followed stations'
  numbers (`建中東側門 借 7 · 還 41`; counts until loaded) → 交通.
- Section "學生福利": `Row`s 建北特約 (合作店家優惠), 校慶紀念品. Section "工具":
  選擇障礙小幫手. All prominent headers.

### 建北特約 (Promo), 選擇障礙小幫手 (Help), 關於 (About), 設定 (Settings)
- Promo: Section "建北特約" `TextBlock`s; Section "尋找特約店家" link `Row`s with
  `storefront`/`mappin` symbols and external accessory.
- Help: Section `TextFieldRow` multiline 選項 + footer hint; `ButtonRow
  prominent` 幫我選 / 再選一次; result Section "就選這個" with a large
  `TextBlock`.
- About: Section app identity (`Row` CK APP / 你的校園助理, detail 版本 x.y.z);
  Section "關於這個 APP" `TextBlock`s; Section "聯絡我們" link rows (mail,
  Instagram, web symbols, external accessory).
- Settings (sheet; header ✓ on iOS, close icon on Android): Section
  "我的班級" menu `PickerRow` 班級 (confirm Alert + revert; 尚未選擇 and no
  confirmation while no class is set; footer 換班級會載入那一班的課表。); Section 「今天」顯示 with `ToggleRow`s 今日待辦與活動,
  午餐, 回家, 釘選的校網消息 (footer: the 現在 card always shows); Section
  "行事曆" `ToggleRow` 只顯示和高X有關的學校活動; Section "資料" destructive
  `ButtonRow` 重設個人資料與設定 + footer (the reset closes every sheet and returns to 你是哪一班？, as on a new install); Section
  with `Row` 關於 CK APP (detail: the version) → 關於. iOS switches are the
  system green, as in Settings.

### Welcome (你是哪一班？, /welcome)
- Shown once on a new install, full screen, before 今天: the 倒三角 over the
  title (`TextBlock size="title" brandMark`), a line on what the class is for
  and that it stays on the phone, segmented 高一 / 高二 / 高三, the grade's
  classes as a `ChoiceGrid`, a prominent 開始使用 (enabled once a class is
  chosen; loads its timetable) and 先看看，之後再選. Either way
  `settings.welcomed` is set and 今天 opens. Skipping leaves the class empty
  (`DEFAULT_CLASS` is ""): 今天's card then says 選擇班級 and its chip 班級,
  課表's empty state offers 選擇班級, and 設定's 班級 picker shows 尚未選擇 until
  one is picked (the first pick needs no confirmation). No class is ever
  assumed.

### 紀念品 (Souvenir)
- Keeps the WebView (it is a website). Failure → kit `EmptyState` 目前無法載入
  紀念品商店。 with 重試 and 在瀏覽器開啟 actions; header button 在瀏覽器開啟.

### Widgets (iOS)
- The 現在 widget (`src/widgets/`, expo-widgets): Home Screen small and medium
  on the navy (eyebrow, subject, the bell rail with ▼, a live countdown
  `22:56 後下課` in the timer style; the medium one lists the rest of the day,
  `英語文 11:10 · 午餐 12:00 · 地理 · 連堂 13:00`), Lock Screen rectangular
  (▼, period and subject, countdown, next) and inline in the system's
  monochrome. The rail's kinds differ by shape, not only by colour: a lesson
  is a 4 pt bar, a 空堂 a 2 pt bar, lunch a short dash; passed bars are white,
  the rest 45% white (3.5:1 on the navy). The
  layout is a `'widget'` function (Babel turns it into source text that the
  extension runs with @expo/ui's SwiftUI views as globals).
- At launch, the app registers the layout before onboarding or timetable
  loading. An empty installation gets a 選擇班級 / 打開 App 選擇班級 snapshot
  for the widget gallery; an existing saved timeline is preserved. WidgetKit's
  empty-props placeholder uses the same fallback.
- The app writes the timeline whenever 今天's inputs change and once a day: the
  next 36 hours, one entry per bell and midnight (`now-timeline.ts`,
  unit-tested), so the widget follows the school day without the app open.
- Included by default at prebuild: it adds the extension
  (`org.capacitor.quasar.ckapp.ExpoWidgetsTarget`) and the App Group
  `group.org.capacitor.quasar.ckapp`. Both the app and extension identifiers
  must have that App Group registered in the Apple Developer account. Release
  signing validates and uses a separate distribution profile for each target
  (`BUILD_PROVISION_PROFILE_BASE64` and `BUILD_WIDGET_PROVISION_PROFILE_BASE64`).
  `ENABLE_WIDGETS=0` opts out locally when the signing setup lacks App Groups.
  Native regeneration and reinstallation are required to add the extension
  to an existing app; Metro reloads and Expo Go cannot install it.
- A Live Activity would need a push server to move from one period to the
  next while the app is closed, so there is none.

### Text sizes

On iOS every piece of text uses a system text style, never a fixed size (a
bare `font({ size })` in @expo/ui never scales); the one exception is the
64 pt decorative 倒三角 on the welcome screen. Android uses Material type
styles, plus a few small fixed sp sizes (the ▼, 放假 captions, the 56 sp
倒三角), which still follow the font scale. Geometry drawn around text (the rail's
offsets and ▼, the day circle, the grid's marker row) grows with the text
through `layoutScale` (src/ui/ios/helpers.ts) up to the layout's own
`dynamicTypeSize` cap, and layouts that cannot hold the accessibility sizes
(the week grid, the day strip, the calendar) cap there instead of truncating:
the grid drops the start times from its row labels and stacks 放假 under the
date, section headers stack their badge, detail and action, the 現在 card
stacks its pairs and drops the rail's labels. 課表 goes further and lists the
week at those sizes (`useAccessibilityTextSize`), so its text takes the size
chosen; on Android, whose grid text is not capped, a cell ends a name it
cannot fit in three lines with an ellipsis.

The 熱食部 picture fits the remaining viewport at ordinary text sizes with
a legibility floor that grows with font scale. At accessibility sizes it
keeps the full-width dish band and allows scrolling; its native dish list
uses the system's row text sizes.

## Verification

No simulator is available in CI-less development here, so every change must
pass `yarn typecheck`, `yarn lint`, `yarn test --runInBand`, and
`npx expo export --platform ios` / `--platform android` (Hermes bundles), and
every `@expo/ui` prop used must exist in `node_modules/@expo/ui/build/**.d.ts`.
On-device checks for both platforms remain required before release
(`docs/native-rewrite-progress.md`).
