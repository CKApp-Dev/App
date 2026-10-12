import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { icons } from '@/components/icons';
import { useNow } from '@/features/home/use-now';
import { gradeOfClass, schoolDayOf, type SchoolCalendarContext } from '@/features/todo/school-days';
import { useSchoolEvents } from '@/features/todo/use-school-events';
import { useScheduleStore } from '@/store/schedule';
import { usePalette } from '@/theme/palette';
import {
  classTimetable,
  describeWeek,
  scheduleSubtitle,
  type WeekModel,
} from '@/features/schedule/schedule-view';
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Weekday,
} from '@/features/schedule/timetable';
import { useTimetables } from '@/features/schedule/use-timetables';
import { useTimetableAutofill } from '@/features/home/use-timetable-autofill';
import { EmptyState, DayStrip, ListScreen, Loading, Row, Section } from '@/ui';

const CLOCK_INTERVAL_MS = 30_000;

function isWeekday(value: string | undefined): value is Weekday {
  return value !== undefined && WEEKDAYS.includes(value as Weekday);
}

function dayIndex(week: WeekModel, day: Weekday): number {
  return week.columns.findIndex((column) => column.key === day);
}

export default function ScheduleDayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const timetable = useTimetables();
  const data = timetable.data;
  const userClass = useScheduleStore((state) => state.userClass);
  const rows = useScheduleStore((state) => state.rows);
  const school = useSchoolEvents();
  const { scheme } = usePalette();
  const now = useNow(CLOCK_INTERVAL_MS);

  useTimetableAutofill(data?.byClass);

  const base = classTimetable(data, userClass);
  const calendar: SchoolCalendarContext = {
    events: school.events,
    term: school.term,
    grade: gradeOfClass(userClass),
  };
  const week = describeWeek({
    rows,
    base,
    periods: data?.periods ?? [],
    semesterStart: data?.semesterStart ?? null,
    now,
    scheme,
    offDay: (date) => {
      const day = schoolDayOf(date, calendar);
      return day.kind === 'off' ? day.name : null;
    },
  });
  const defaultDay = week.columns.find((column) => column.today)?.key ?? 'Monday';
  const selectedDay = isWeekday(params.day) ? params.day : defaultDay;
  const selectedIndex = dayIndex(week, selectedDay);
  const selectedColumn = week.columns[selectedIndex];
  const selectedRows = week.rows.map((row, rowIndex) => ({
    row,
    cell: week.cells[rowIndex]?.[selectedIndex],
    source: rows.find((candidate) => candidate.name === row.key)?.[selectedDay],
  })).filter((entry) => entry.cell !== undefined);
  const notes = selectedRows.filter((entry) => entry.source?.note?.trim());

  function selectDay(day: string) {
    if (isWeekday(day)) router.setParams({ day });
  }

  return (
    <>
      <Stack.Screen options={{ title: '每日課表' }} />
      <ListScreen
        subtitle={scheduleSubtitle(userClass, data?.semesterStart ?? null, now)}
        onRefresh={() => timetable.refetch()}
      >
        <Section plain>
          <DayStrip
            days={week.columns.map((column) => ({
              key: column.key,
              weekday: column.label,
              day: column.date,
              holiday: column.off ?? undefined,
              isToday: column.today,
              accessibilityLabel: column.accessibilityLabel,
            }))}
            selectedKey={selectedDay}
            onSelect={selectDay}
          />
        </Section>
        {!userClass || !rows.length ? (
          <Section plain>
            <EmptyState
              icon={icons.school}
              title={userClass ? '課表尚未載入' : '還沒有選班級'}
              description={userClass ? '請稍候或下拉重新整理。' : '選好班級，就能看到每日課表。'}
            />
          </Section>
        ) : timetable.isPending ? (
          <Section><Loading label="正在載入課表…" /></Section>
        ) : (
          <>
            <Section
              title={selectedColumn ? WEEKDAY_LABELS[selectedColumn.key] : '每日課表'}
              detail={selectedColumn ? `${selectedColumn.detail}${selectedColumn.off ? ` · ${selectedColumn.off}` : ''}` : undefined}>
              {selectedRows.map(({ row, cell }) => (
                <Row
                  key={cell!.key}
                  overline={`${row.label} · ${row.time}`}
                  title={cell!.subject || '空堂'}
                  note={cell!.details}
                  mark={{ kind: 'period', lines: [row.label], fill: cell!.color, ink: cell!.ink, empty: cell!.subject === '' }}
                  badge={cell!.current ? '現在' : undefined}
                  emphasized={cell!.current}
                  accessibilityLabel={cell!.accessibilityLabel}
                  onPress={() => router.push({ pathname: '/schedule-editor', params: { period: row.key, day: selectedDay } })}
                />
              ))}
            </Section>
            <Section title="備註">
              {notes.length > 0 ? notes.map(({ row, source }) => (
                <Row
                  key={`note-${row.key}`}
                  title={`${row.label} · ${source?.subject || '空堂'}`}
                  subtitle={row.time || undefined}
                  note={source?.note?.trim()}
                  icon={icons.note}
                  onPress={() => router.push({ pathname: '/schedule-editor', params: { period: row.key, day: selectedDay } })}
                />
              )) : (
                <EmptyState icon={icons.note} title="今天沒有備註" description="點選課表中的一節即可新增備註。" />
              )}
            </Section>
          </>
        )}
      </ListScreen>
    </>
  );
}
