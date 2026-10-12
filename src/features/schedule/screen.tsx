// 課表: the user's class timetable as one table for the whole week (a
// coloured cell per period, every subject in its own colour), with the period
// in session marked, each cell opening 編輯課程, plus class switching and
// re-importing from the header menu. At the accessibility text sizes the same
// week is a list, a Section per weekday. Layout per docs/design/native-ui.md,
// "課表 (Schedule)".
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { HeaderActions, type HeaderMenuEntry } from '@/components/header-actions';
import { icons } from '@/components/icons';
import { useNow } from '@/features/home/use-now';
import { useTimetableAutofill } from '@/features/home/use-timetable-autofill';
import { gradeOfClass, schoolDayOf, type SchoolCalendarContext } from '@/features/todo/school-days';
import { useSchoolEvents } from '@/features/todo/use-school-events';
import { confirmPickerChange } from '@/hooks/use-confirmed-picker';
import { useScheduleStore } from '@/store/schedule';
import { usePalette } from '@/theme/palette';
import { EmptyState, ListScreen, Loading, Notice, Row, Section, TimetableGrid, useAccessibilityTextSize } from '@/ui';

import {
  classOptions,
  classTimetable,
  describeWeek,
  scheduleLoadState,
  scheduleSubtitle,
  type ScheduleLoadState,
  type WeekModel,
} from './schedule-view';
import type { ScheduleRow, Timetables, Weekday } from './timetable';
import { useTimetables } from './use-timetables';

/** The 現在 mark is minute-resolution; the clock only ticks while 課表 is focused. */
const CLOCK_INTERVAL_MS = 30_000;

const LOADING_LABEL = '正在載入課表…';

const EDIT_HINT = '點一格可修改科目、單雙週輪替、備註與顏色。';
const LIST_EDIT_HINT = '點選一節可修改科目、單雙週輪替、備註與顏色。';

export default function ScheduleScreen() {
  const timetable = useTimetables();
  const data = timetable.data;
  const userClass = useScheduleStore((state) => state.userClass);
  // Only whether there are rows: editing a slot re-renders the table, not this.
  const hasRows = useScheduleStore((state) => state.rows.length > 0);
  const setClass = useScheduleStore((state) => state.setClass);
  const resetRows = useScheduleStore((state) => state.resetRows);
  const school = useSchoolEvents();
  const calendar: SchoolCalendarContext = { events: school.events, term: school.term, grade: gradeOfClass(userClass) };

  useTimetableAutofill(data?.byClass);

  const original = classTimetable(data, userClass);
  const options = classOptions(data?.classIds ?? [], userClass);
  // None chosen yet, whether or not the timetables loaded: the empty state asks
  // for one either way, and 設定's picker shows its own error and 重新載入.
  const noClass = userClass === '';
  const load = scheduleLoadState({
    hasRows,
    isPending: timetable.isPending,
    isFetching: timetable.isFetching,
    isError: timetable.isError,
  });

  const refresh = () => timetable.refetch();

  // Shared by the 班級 picker and the header's 選擇班級 submenu. Both show
  // userClass, so a declined or impossible change leaves the picker snapping
  // back and the menu's check where it was.
  function changeClass(next: string) {
    if (next === userClass) return;
    const nextRows = classTimetable(data, next);
    // Nothing to switch to. PickerRow always shows `value`, so leaving
    // userClass alone puts the picker back on it.
    if (!nextRows) return;
    // With no timetable there are no edits to lose, so nothing to confirm. The
    // rows decide, not the class: an import whose class could not be read
    // still brings the previous app's edited rows, which a first pick replaces.
    if (!hasRows) {
      setClass(next, nextRows);
      return;
    }
    confirmPickerChange(
      '更改班級',
      `改為 ${next} 班會清除目前課表的修改。`,
      { text: '更改', style: 'destructive', onPress: () => setClass(next, nextRows) },
      // Declined: userClass is unchanged and PickerRow snaps back to it.
      () => {},
    );
  }

  function confirmReimport() {
    if (!original) return;
    Alert.alert('重新匯入課表', '將清除所有科目、備註和顏色修改。', [
      { text: '取消', style: 'cancel' },
      { text: '重新匯入', style: 'destructive', onPress: () => resetRows(original) },
    ]);
  }

  // The 80-odd classes sit in a submenu so they do not bury 重新匯入課表;
  // both wait for the timetables, as the picker and button below do.
  const menu: HeaderMenuEntry[] = [];
  if (data) {
    menu.push({
      kind: 'submenu',
      key: 'class',
      label: '選擇班級',
      icon: icons.school,
      actions: options.map((option) => ({
        key: option.value,
        label: option.label,
        selected: option.value === userClass,
        onPress: () => changeClass(option.value),
      })),
    });
  }
  if (original) {
    menu.push({ key: 'reimport', label: '重新匯入課表', icon: icons.restore, onPress: confirmReimport });
  }
  menu.unshift({
    key: 'daily',
    label: '每日課表',
    icon: icons.calendar,
    onPress: () => router.push('../schedule-day'),
  });

  return (
    <>
      <HeaderActions
        right={menu.length > 0 ? [{ kind: 'menu', key: 'schedule', label: '課表選項', icon: icons.more, actions: menu }] : []}
      />
      <ListScreen subtitle={scheduleSubtitle(userClass, data?.semesterStart ?? null, new Date())} onRefresh={refresh}>
        {load.banner !== 'none' ? (
          <Section>
            {load.banner === 'error' ? (
              <Notice
                tone="error"
                title="暫時無法更新課表"
                message="可下拉重試。"
                action={{ label: '重試', onPress: () => void refresh() }}
              />
            ) : (
              <Loading label={LOADING_LABEL} />
            )}
          </Section>
        ) : null}

        <WeekSection
          timetables={data}
          base={original}
          calendar={calendar}
          state={load.table}
          noClass={noClass}
          // While the error notice above offers 重試, a second button would repeat it.
          onReload={load.banner === 'error' ? undefined : () => void refresh()}
        />
      </ListScreen>
    </>
  );
}

/** No class chosen yet, or the class's timetable has not loaded. */
function NotLoaded({ noClass, onReload }: { noClass: boolean; onReload?: () => void }) {
  return (
    <Section plain>
      {noClass ? (
        <EmptyState
          icon={icons.school}
          title="還沒有選班級"
          description="選好班級，就能看到課表。"
          action={{ label: '選擇班級', onPress: () => router.push('/settings') }}
        />
      ) : (
        <EmptyState
          icon={icons.book}
          title="此班級課表尚未載入"
          description="請選擇班級或重新整理。"
          action={onReload ? { label: '重新整理', onPress: onReload } : undefined}
        />
      )}
    </Section>
  );
}

const openEditor = (period: string, day: Weekday) => router.push({ pathname: '/schedule-editor', params: { period, day } });

/** Why there is no school on `date` (國慶日補假…), or null. */
function offReason(date: Date, calendar: SchoolCalendarContext): string | null {
  const day = schoolDayOf(date, calendar);
  return day.kind === 'off' ? day.name : null;
}

/**
 * The displayed week as one table; days off (from the 行事曆) are dimmed and
 * say 放假. The minute clock lives here, so a tick re-renders only the table,
 * not the header's 80-odd classes.
 */
function WeekSection({ timetables, base, calendar, state, noClass, onReload }: {
  timetables: Timetables | undefined;
  /** The class's own timetable, which anchors the subjects' colours. */
  base: readonly ScheduleRow[] | undefined;
  calendar: SchoolCalendarContext;
  state: ScheduleLoadState['table'];
  /** The empty state asks for a class instead of a reload. */
  noClass: boolean;
  /** The empty state's 重新整理; left out to hide it. */
  onReload?: () => void;
}) {
  const now = useNow(CLOCK_INTERVAL_MS);
  const { scheme } = usePalette();
  const rows = useScheduleStore((store) => store.rows);
  const largeText = useAccessibilityTextSize();

  if (state === 'loading') {
    return (
      <Section>
        <Loading label={LOADING_LABEL} />
      </Section>
    );
  }
  if (state === 'empty') return <NotLoaded noClass={noClass} onReload={onReload} />;

  const week = describeWeek({
    rows,
    base,
    periods: timetables?.periods ?? [],
    semesterStart: timetables?.semesterStart ?? null,
    now,
    scheme,
    offDay: (date) => offReason(date, calendar),
  });
  if (largeText) return <WeekList week={week} />;
  return (
    <Section plain footer={EDIT_HINT}>
      <TimetableGrid
        columns={week.columns.map((column) => ({
          key: column.key,
          label: column.label,
          detail: column.date,
          highlighted: column.today,
          holiday: column.off ? '放假' : undefined,
          accessibilityLabel: column.accessibilityLabel,
        }))}
        rows={week.rows}
        cells={week.cells}
        breakAfter={
          week.lunchAfter !== null ? { index: week.lunchAfter, label: week.lunchTime ? `午休 ${week.lunchTime}` : '午休' } : undefined
        }
        onPress={(row, column) => openEditor(week.rows[row].key, week.columns[column].key)}
      />
    </Section>
  );
}

/**
 * The same week as a list, for the accessibility text sizes, where five
 * columns cannot hold the text at the size chosen: a Section per weekday
 * (its date, 今天 or why there is no school), a row per period with its
 * badge in the subject's colour, the bell times, and the rotation and note.
 */
function WeekList({ week }: { week: WeekModel }) {
  return (
    <>
      {week.columns.map((column, columnIndex) => (
        <Section
          key={column.key}
          title={`星期${column.label}`}
          detail={[column.detail, column.today ? '今天' : '', column.off ?? ''].filter(Boolean).join(' · ')}
          footer={columnIndex === week.columns.length - 1 ? LIST_EDIT_HINT : undefined}>
          {week.rows.map((row, rowIndex) => {
            const cell = week.cells[rowIndex]?.[columnIndex];
            if (!cell) return null;
            return (
              <Row
                key={cell.key}
                title={cell.subject || '空堂'}
                subtitle={row.time || undefined}
                note={cell.details}
                mark={{ kind: 'period', lines: [row.label], fill: cell.color, ink: cell.ink, empty: cell.subject === '' }}
                badge={cell.current ? '現在' : undefined}
                emphasized={cell.current}
                accessibilityLabel={cell.accessibilityLabel}
                onPress={() => openEditor(row.key, column.key)}
              />
            );
          })}
        </Section>
      ))}
    </>
  );
}
