import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * The tab bar: five fixed sections, in this order. Everything else lives
 * inside one of them: 熱食部 in 美食, and 校網, 交通, 建北特約, 校慶紀念品 and
 * 選擇障礙小幫手 in 校園. See docs/design/native-ui.md, "Navigation chrome".
 */
export const TABS = [
  { name: 'home', label: '今天', sf: { default: 'sun.max', selected: 'sun.max.fill' }, md: 'light_mode' },
  { name: 'schedule', label: '課表', sf: { default: 'tablecells', selected: 'tablecells.fill' }, md: 'table_chart' },
  { name: 'todo', label: '行事曆', sf: { default: 'calendar', selected: 'calendar' }, md: 'calendar_month' },
  { name: 'food', label: '美食', sf: { default: 'fork.knife', selected: 'fork.knife' }, md: 'restaurant' },
  {
    name: 'campus',
    label: '校園',
    sf: { default: 'building.columns', selected: 'building.columns.fill' },
    md: 'account_balance',
  },
] as const satisfies readonly {
  /** The route folder under src/app/(tabs). */
  name: string;
  label: string;
  sf: { default: SFSymbol; selected: SFSymbol };
  md: AndroidSymbol;
}[];

/** The screens 校園 pushes, by route name under src/app/(tabs)/campus. */
export const CAMPUS_SCREENS = [
  { name: 'news', title: '校網' },
  { name: 'transport', title: '交通' },
  { name: 'promo', title: '建北特約' },
  { name: 'souvenir', title: '校慶紀念品' },
  { name: 'tickets', title: '建中舞會門票' },
  { name: 'help', title: '選擇障礙小幫手' },
] as const;
