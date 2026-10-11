// The native UI kit's contract. Screens import components from '@/ui'; each
// platform implements every component below with its own native toolkit:
// kit.ios.tsx (SwiftUI via @expo/ui/swift-ui) and kit.android.tsx (Jetpack
// Compose Material 3 via @expo/ui/jetpack-compose). See docs/design/native-ui.md.
//
// Composition rules:
// - A ListScreen contains only Sections.
// - A Section contains rows: Row, CheckRow, ToggleRow, PickerRow, TextFieldRow,
//   DateRow, ButtonRow, TextBlock, EmptyState, Notice, Loading, FilterChips,
//   TileGrid, ChoiceGrid, MonthCalendar, TimetableGrid, Embedded; NowCard and
//   DayStrip go alone in a plain Section.
// - An Embedded with fit 'screen' goes alone in the last Section of its
//   ListScreen.
// - MetricPills and CrowdBar only go in Row.footer.
// - Never put raw React Native or @expo/ui views inside a kit tree; Embedded
//   is the one way to show React Native content (maps, images).
import type { ComponentType, ReactElement, ReactNode } from 'react';

import type { icons } from '@/components/icons';

/** An SF Symbol on iOS, a Material Symbols vector on Android (see icons.ts). */
export type IconValue = (typeof icons)[keyof typeof icons];

/** "#RRGGBB" */
export type HexColor = string;

export interface ListScreenProps {
  children: ReactNode;
  /**
   * A line under the screen's title, e.g. 10月7日 星期三 · 第 6 週 · 雙週. iOS
   * shows it under the large title, Android at the top of the list.
   */
  subtitle?: string;
  /**
   * Pull to refresh. The indicator stays until the returned promise settles
   * (SwiftUI `refreshable` awaits it; Compose `PullToRefreshBox` is driven
   * from it). Omit to disable pull to refresh.
   */
  onRefresh?: () => Promise<unknown> | void;
  /**
   * Shows the refresh indicator without a pull, e.g. while a header 重新整理
   * button's refresh runs; for screens that also pass `onRefresh`. Android
   * shows pull to refresh's own indicator. SwiftUI cannot
   * start `refreshable`'s spinner from code, so iOS shows a spinner row above
   * the first section instead (not during a pull, which has its own).
   */
  refreshing?: boolean;
  /** Android only: an extended FAB for the screen's primary action. iOS puts that action in the navigation bar instead and ignores this. */
  fab?: { label: string; icon: IconValue; onPress: () => void };
}

export interface SectionProps {
  title?: string;
  /** Short text after the title in the tint, e.g. 2 則未讀. */
  titleBadge?: string;
  /** Trailing header text, e.g. 08:10–12:00 or 8 道. At the accessibility text sizes iOS puts it on its own line under the title. */
  detail?: string;
  /** A trailing header link, e.g. 全部. At the accessibility text sizes iOS puts it on its own line under the title. */
  action?: KitAction;
  /**
   * A large bold header (iOS: increased header prominence), for the groups
   * of an overview screen such as 今天 and 校園.
   */
  prominent?: boolean;
  footer?: string;
  /** A link after the footer text, e.g. 全部顯示 or 重試. */
  footerAction?: KitAction;
  /**
   * Rows without the grouped container: no card on Android, a clear row
   * background on iOS. For a lone segmented control, filter chips or an
   * empty state, which look heavy inside a card.
   */
  plain?: boolean;
  /**
   * Sits close under the section above: 12pt on iOS 17 and later (Android
   * keeps its 16dp). For content that belongs with the control above it, e.g.
   * 熱食部's menu under its week strip.
   */
  tight?: boolean;
  children?: ReactNode;
}

export interface RowAction {
  key: string;
  label: string;
  icon?: IconValue;
  destructive?: boolean;
  /** Shown but not selectable (greyed in the menus, left out of iOS swipe actions). */
  disabled?: boolean;
  onPress: () => void;
}

/** A two-state quick action on a row, e.g. pin or favourite. */
export interface RowToggle {
  /** Label describing what pressing does now, e.g. 釘選 / 取消釘選. */
  label: string;
  icon: IconValue;
  activeIcon: IconValue;
  active: boolean;
  onPress: () => void;
  /**
   * Also a trailing button that always shows the state (the 美食 hearts).
   * Without it iOS shows only a small symbol while active.
   */
  button?: boolean;
  /** The active icon's colour, e.g. a red heart. @default the tint */
  activeColor?: HexColor;
}

/** A text mark in the row's leading column, in place of an icon or dot. */
export type RowMark =
  /** One bold character, e.g. 考 for an exam. */
  | { kind: 'glyph'; text: string }
  /** A weekday over its day number, e.g. 四 / 8. */
  | { kind: 'date'; weekday: string; day: string }
  /** A list number, e.g. 1. */
  | { kind: 'index'; text: string }
  /**
   * A rounded badge with the period numerals, stacked for a 連堂 (一 / 二),
   * in the subject's colours; `empty` (a 空堂) is a dashed outline.
   */
  | { kind: 'period'; lines: readonly string[]; fill?: HexColor; ink?: HexColor; empty?: boolean };

export type RowAccessory = 'none' | 'chevron' | 'external' | 'checkmark';

export interface RowProps {
  title: string;
  subtitle?: string;
  /** Small text above the title (e.g. 第一節 · 08:10, 已釘選). */
  overline?: string;
  /** Trailing value text (e.g. a countdown or hours). */
  detail?: string;
  icon?: IconValue;
  iconColor?: HexColor;
  /** Leading filled dot (category or status colour). Ignored when `icon` is set. */
  dotColor?: HexColor;
  /** `dotColor` as a small rounded square: a calendar event. @default 'dot' */
  dotShape?: 'dot' | 'square';
  /** A leading text mark (考, a date, a period badge). Ignored when `icon` is set. */
  mark?: RowMark;
  /** Secondary text after the title on its line, e.g. a nickname (林乾). */
  titleAside?: string;
  /** A status dot before the subtitle, e.g. green for 營業中. */
  subtitleDotColor?: HexColor;
  /** A third line under the subtitle, e.g. the period's note. */
  note?: string;
  /** Small grey tags above the title, e.g. 116升學. */
  tags?: readonly string[];
  /** A bold title in the label colour, e.g. an unread item. */
  strong?: boolean;
  /** `detail` in bold and the label colour, e.g. 還有 6 天 or $120. */
  detailProminent?: boolean;
  /** Fill colour of the whole row (timetable cell colours). */
  background?: HexColor;
  /** Small pill after the title, e.g. 目前 / 今天. */
  badge?: string;
  /** Tint the title and subtitle, title semibold (the period in session, today). */
  emphasized?: boolean;
  /** Maximum title lines. @default 2 */
  titleLines?: number;
  /** @default 'none' */
  accessory?: RowAccessory;
  onPress?: () => void;
  /**
   * Secondary actions. iOS: trailing swipe actions plus a long-press context
   * menu. Android: a trailing overflow (more_vert) dropdown menu, named after
   * the row for TalkBack. They stay available on a disabled row; disable an
   * action itself with `RowAction.disabled`.
   */
  actions?: readonly RowAction[];
  /**
   * iOS: leading swipe action, context-menu item and a small trailing symbol
   * when active. Android: a trailing icon button. Stays available on a
   * disabled row, like `actions`.
   */
  toggle?: RowToggle;
  /** Kit inline elements shown under the subtitle (MetricPills, CrowdBar). */
  footer?: ReactNode;
  /** Overrides the spoken label (defaults to title, overline, subtitle, detail, badge). */
  accessibilityLabel?: string;
  /**
   * Dims the row and turns off its own tap (`onPress`) only. `actions` and
   * `toggle` stay available, but on iOS a full swipe no longer fires the edge
   * action: a dimmed row should not act on a single gesture.
   */
  disabled?: boolean;
}

export interface CheckRowProps {
  title: string;
  subtitle?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Tapping the row body (not the checkbox), e.g. to edit. */
  onPress?: () => void;
  actions?: readonly RowAction[];
}

export interface ToggleRowProps {
  label: string;
  subtitle?: string;
  icon?: IconValue;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Turns off the switch only; `actions` stay available (e.g. 上移/下移 at a limit). */
  disabled?: boolean;
  /** iOS: the long-press context menu. Android: an overflow menu named after the row. */
  actions?: readonly RowAction[];
}

export interface ChoiceOption<T extends string = string> {
  label: string;
  value: T;
  /**
   * A round dot in this colour before the label, e.g. the colour a 顏色
   * option names; once any option has one, the others keep its column with
   * an empty ring. iOS lists such options inline (a menu would draw every dot
   * in the tint); Android keeps its dropdown. Menu pickers only.
   */
  dot?: HexColor;
}

/**
 * A single choice. The native control always shows `value`: when the parent
 * does not adopt a selection (e.g. the user cancels a confirmation alert),
 * the control snaps back to `value`.
 */
export interface PickerRowProps<T extends string = string> {
  label: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  /** @default 'menu' */
  variant?: 'menu' | 'segmented';
  icon?: IconValue;
  disabled?: boolean;
}

export interface TextFieldRowProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'default' | 'url' | 'email' | 'numeric';
  autoFocus?: boolean;
  maxLength?: number;
}

export interface DateRowProps {
  label: string;
  /** Local date "YYYY-MM-DD". */
  value: string;
  onChange: (value: string) => void;
  /** Local date "YYYY-MM-DD". */
  minimumDate?: string;
}

export interface ButtonRowProps {
  label: string;
  icon?: IconValue;
  /** @default 'default' */
  role?: 'default' | 'destructive';
  /** The screen's main action (filled / borderedProminent). */
  prominent?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface TextBlockProps {
  text: string;
  secondary?: boolean;
  /** body; large: a bold title-2 line; title: a page title (large title, bold). @default 'body' */
  size?: 'body' | 'large' | 'title';
  /** Draws the CK 倒三角 above a `title`, e.g. on the welcome screen. */
  brandMark?: boolean;
  selectable?: boolean;
}

export interface KitAction {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon: IconValue;
  action?: KitAction;
  secondaryAction?: KitAction;
}

export interface NoticeProps {
  tone: 'error' | 'info';
  title: string;
  message?: string;
  action?: KitAction;
}

export interface LoadingProps {
  label: string;
}

export interface FilterChipsProps {
  options: readonly { key: string; label: string; selected: boolean; icon?: IconValue }[];
  onToggle: (key: string) => void;
}

export interface TileGridProps {
  tiles: readonly { key: string; title: string; icon: IconValue; onPress: () => void }[];
  /** @default 3 */
  columns?: number;
}

/**
 * One choice among many as a grid of buttons, e.g. the welcome screen's
 * classes; the selected one is filled with the tint.
 */
export interface ChoiceGridProps {
  options: readonly ChoiceOption[];
  /** The selected value, or null for none. */
  value: string | null;
  onChange: (value: string) => void;
  /** @default 5 */
  columns?: number;
  /** Spoken before each option, e.g. 班級. */
  accessibilityLabel?: string;
}

export interface DayStripDay {
  key: string;
  /** e.g. 三 */
  weekday: string;
  /** e.g. 7 */
  day: string;
  isToday?: boolean;
  /** A day off: the number turns red over this caption, e.g. 放假. */
  holiday?: string;
  accessibilityLabel: string;
}

/**
 * A school week as a row of days (weekday over date), for 課表 and 熱食部:
 * the selected day sits in a tint circle, today has the 倒三角 over its
 * weekday. Goes alone in a plain Section.
 */
export interface DayStripProps {
  days: readonly DayStripDay[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export interface CalendarIndicator {
  key: string;
  color: HexColor;
  /** Events are dots, todos are squares. */
  shape: 'dot' | 'square';
}

/**
 * How many indicators every platform draws under a day number; later ones
 * are dropped, so callers choose which CALENDAR_CELL_INDICATORS matter most.
 * Import it from '@/ui/types': '@/ui' re-exports this file's types only.
 */
export const CALENDAR_CELL_INDICATORS = 3;

export interface CalendarCell {
  /** "YYYY-MM-DD" */
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /** Only the first CALENDAR_CELL_INDICATORS are drawn. */
  indicators: readonly CalendarIndicator[];
  /**
   * A one-character mark drawn instead of the indicators: 假 for a day off
   * (the day number turns red too, as on printed Taiwanese calendars) or 考
   * for an exam day. The spoken label names the day itself.
   */
  mark?: { text: string; tone: 'holiday' | 'exam' };
  accessibilityLabel: string;
}

export interface MonthCalendarProps {
  /** Column headers, Sunday first. */
  weekdays: readonly string[];
  /** 42 cells (six weeks, Sunday first). */
  cells: readonly CalendarCell[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export interface MetricPillsProps {
  metrics: readonly { key: string; label: string; color: HexColor; icon?: IconValue }[];
}

export interface CrowdBarProps {
  /** One entry per car, front car first. */
  levels: readonly { key: string; color: HexColor }[];
  accessibilityLabel: string;
}

export interface NowRailSegment {
  key: string;
  /** Short label under it: the period's numeral (一 … 八), or 午 for lunch. */
  label: string;
  /** Minutes since midnight. */
  start: number;
  end: number;
  /** lesson: a bar that fills as it passes; free (空堂): an outline; lunch: a dotted line. */
  kind: 'lesson' | 'free' | 'lunch';
  /** How much of it has passed, 0–1. */
  progress: number;
  current: boolean;
}

/** The school day drawn to scale: one segment per period (and lunch), gaps for the breaks. */
export interface NowRail {
  /** Minutes since midnight at the rail's two ends. */
  start: number;
  end: number;
  /** Where the 倒三角 points, or null outside the day. */
  now: number | null;
  segments: readonly NowRailSegment[];
}

/**
 * 今天's 現在 card: the one CK-navy block in the app. Goes alone in a `plain`
 * Section; it draws its own card on every platform. Decorative parts (the
 * rail) are hidden from screen readers, which read `accessibilityLabel`.
 */
export interface NowCardProps {
  /** e.g. 第三節 */
  eyebrow: string;
  /** Trailing on the eyebrow line, e.g. 10:10–11:00 */
  eyebrowDetail?: string;
  /** e.g. the subject, 放學了, 國慶日補假 */
  title: string;
  subtitle?: string;
  rail?: NowRail;
  /** e.g. 23 分鐘後下課 */
  footer?: string;
  /** Trailing on the footer line, e.g. 接下來 英語文 11:10 */
  footerDetail?: string;
  /** Label / value lines under a divider, e.g. the commute. */
  details?: readonly { key: string; label: string; value: string }[];
  accessibilityLabel: string;
  onPress?: () => void;
}

export interface TimetableGridColumn {
  key: string;
  /** e.g. 一 */
  label: string;
  /** The date, e.g. 5 */
  detail?: string;
  /** Today's column: its header is tinted under the 倒三角. */
  highlighted?: boolean;
  /** A day off: its cells are dimmed and the date is red over this caption, e.g. 放假. */
  holiday?: string;
  accessibilityLabel?: string;
}

export interface TimetableGridCell {
  key: string;
  /** The subject in full, or a free period's note; '' for neither. */
  text: string;
  /** The lesson's fill (the user's colour, else the subject's own); undefined keeps the plain cell. */
  color?: HexColor;
  /** The text colour on `color`. */
  ink?: HexColor;
  /** Nothing to show (a free period without a note): nothing is drawn, but the slot still takes a tap (to fill it). */
  empty?: boolean;
  /** The slot has a note: a small note mark under the text. */
  note?: boolean;
  /** The period in session: a ring in the tint round the cell, a free one too, so 現在 is not told by colour alone. */
  current?: boolean;
  accessibilityLabel: string;
}

/** A week timetable: weekday columns, period rows, an optional labelled gap (lunch). */
export interface TimetableGridProps {
  columns: readonly TimetableGridColumn[];
  /**
   * One per period, e.g. { label: '一', detail: '08:10' }; `highlighted` is
   * the period in session. iOS leaves `detail` out from the xxxLarge text
   * size up, where it no longer fits beside the grid.
   */
  rows: readonly { key: string; label: string; detail?: string; highlighted?: boolean }[];
  /** cells[row][column] */
  cells: readonly (readonly TimetableGridCell[])[];
  /** A labelled gap after row `index`, e.g. 午休 12:00–13:00. */
  breakAfter?: { index: number; label: string };
  onPress?: (row: number, column: number) => void;
}

export interface EmbeddedProps {
  /** A React Native element (map, image). */
  children: ReactElement;
  height?: number;
  /** width / height; used when `height` is not given. */
  aspectRatio?: number;
  /**
   * 'screen': once the list is at rest, no taller than the room from this
   * view's top to the end of the visible list (above the tab or navigation
   * bar), so it shows whole without scrolling. Never taller than its natural
   * size (`height`, else width / `aspectRatio`) or `maxHeight`; with less room
   * than `minHeight` it keeps its natural size and the list scrolls. The
   * content shows once its height is settled. @default 'width'
   */
  fit?: 'width' | 'screen';
  /** fit 'screen': the least room worth fitting into; Infinity always keeps the natural size. @default 0 */
  minHeight?: number;
  /** fit 'screen': the most it grows to. */
  maxHeight?: number;
  /**
   * Makes the whole view one button, laid over the content: the content then
   * takes no touches and is hidden from VoiceOver and TalkBack, which read
   * `accessibilityLabel` instead.
   */
  onPress?: () => void;
  /** The button's spoken label; required with `onPress`. */
  accessibilityLabel?: string;
  /** What the button does, e.g. what it opens (VoiceOver only). */
  accessibilityHint?: string;
}

/** Every platform kit file must satisfy this (checked with `satisfies Kit`). */
export interface Kit {
  ListScreen: ComponentType<ListScreenProps>;
  Section: ComponentType<SectionProps>;
  Row: ComponentType<RowProps>;
  CheckRow: ComponentType<CheckRowProps>;
  ToggleRow: ComponentType<ToggleRowProps>;
  PickerRow: <T extends string>(props: PickerRowProps<T>) => ReactNode;
  TextFieldRow: ComponentType<TextFieldRowProps>;
  DateRow: ComponentType<DateRowProps>;
  ButtonRow: ComponentType<ButtonRowProps>;
  TextBlock: ComponentType<TextBlockProps>;
  EmptyState: ComponentType<EmptyStateProps>;
  Notice: ComponentType<NoticeProps>;
  Loading: ComponentType<LoadingProps>;
  FilterChips: ComponentType<FilterChipsProps>;
  TileGrid: ComponentType<TileGridProps>;
  ChoiceGrid: ComponentType<ChoiceGridProps>;
  DayStrip: ComponentType<DayStripProps>;
  MonthCalendar: ComponentType<MonthCalendarProps>;
  MetricPills: ComponentType<MetricPillsProps>;
  CrowdBar: ComponentType<CrowdBarProps>;
  Embedded: ComponentType<EmbeddedProps>;
  NowCard: ComponentType<NowCardProps>;
  TimetableGrid: ComponentType<TimetableGridProps>;
  /**
   * Whether the text is so large that columns side by side should stack, as
   * for a screen that swaps a grid for a list: the accessibility text sizes
   * on iOS (SwiftUI's isAccessibilitySize), a font scale of 1.5 or more on
   * Android.
   */
  useAccessibilityTextSize: () => boolean;
}
