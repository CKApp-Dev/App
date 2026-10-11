// 今天: the 現在 card (what is happening at this minute of the school day, on
// the bell rail), then the sections chosen in 設定: 今日, 午餐, 回家 and the
// pinned 校網 items. Layout per docs/design/native-ui.md, "今天 (Today)".
import { router, type Href } from 'expo-router';

import { HeaderActions } from '@/components/header-actions';
import { AnnouncementsSection } from '@/features/announcements/section';
import { useAnnouncements } from '@/features/announcements/use-announcements';
import { getWeekNumber, getWeekParity } from '@/features/schedule/timetable';
import { useTimetables } from '@/features/schedule/use-timetables';
import { gradeOfClass, schoolDayOf, type SchoolCalendarContext } from '@/features/todo/school-days';
import { useSchoolEvents } from '@/features/todo/use-school-events';
import { toDateKey } from '@/lib/dates';
import { useScheduleStore } from '@/store/schedule';
import { useSettingsStore } from '@/store/settings';
import { ListScreen, Loading, Notice, NowCard, Section } from '@/ui';
import { useNowWidget } from '@/widgets/use-now-widget';

import { hasRail, nowCard, nowState, railOf, slotsOn, type NowState } from './now';
import { AgendaSection, CommuteSection, LunchSection, PinnedSection } from './sections';
import { todayHeading } from './today';
import { useCommute } from './use-commute';
import { useNow } from './use-now';
import { useTimetableAutofill } from './use-timetable-autofill';

/** Minute-resolution UI; the clock only ticks while 今天 is focused. */
const CLOCK_INTERVAL_MS = 30_000;

/** When the bell data has no lunch break, lunch is over at 13:00. */
const DEFAULT_LUNCH_END = 13 * 60;

/** Where tapping the card goes: the thing it is about. */
function cardTarget(state: NowState, hasCommute: boolean): Href {
  switch (state.kind) {
    case 'lunch':
      return { pathname: '/(tabs)/food', params: { view: 'menu' } };
    case 'after-school':
      return hasCommute ? '/(tabs)/campus/transport' : '/(tabs)/schedule';
    case 'exam':
    case 'day-off':
      return '/(tabs)/todo';
    case 'no-timetable':
      return '/settings';
    default:
      return '/(tabs)/schedule';
  }
}

export default function TodayScreen() {
  const now = useNow(CLOCK_INTERVAL_MS);
  const widgets = useSettingsStore((state) => state.homeWidgets);
  const timetable = useTimetables();
  const school = useSchoolEvents();
  const announcements = useAnnouncements();
  const userClass = useScheduleStore((state) => state.userClass);
  const rows = useScheduleStore((state) => state.rows);

  useTimetableAutofill(timetable.data?.byClass);

  const calendar: SchoolCalendarContext = { events: school.events, term: school.term, grade: gradeOfClass(userClass) };
  const data = timetable.data;
  // The Home Screen and Lock Screen widget follows the same day (in builds that have it).
  useNowWidget(data ? { ...calendar, periods: data.periods, rows, semesterStart: data.semesterStart } : null, toDateKey(now));
  const state = data ? nowState({ ...calendar, now, periods: data.periods, rows, semesterStart: data.semesterStart, userClass }) : null;
  const rail = data ? railOf(now, slotsOn(now, data.periods, rows, data.semesterStart)) : null;

  // The commute is fetched live only around it: before school and after.
  const commuteTime = state?.kind === 'before-school' || state?.kind === 'after-school';
  const commute = useCommute({ enabled: widgets.commute, live: commuteTime });
  const details = commuteTime ? commute.cardLines.map(({ key, label, value }) => ({ key, label, value })) : [];

  let card = null;
  if (state) {
    const content = nowCard(state, now, rail);
    card = (
      <NowCard
        {...content}
        details={[...(content.details ?? []), ...details]}
        accessibilityLabel={[content.accessibilityLabel, ...details.map((line) => `${line.label} ${line.value}`)].join('，')}
        onPress={() => router.navigate(cardTarget(state, details.length > 0))}
      />
    );
  } else if (timetable.isError) {
    card = (
      <Notice
        tone="error"
        title="課表目前無法載入"
        message="請連線後重試。"
        action={{ label: '重試', onPress: () => void timetable.refetch() }}
      />
    );
  } else {
    card = <Loading label="正在載入課表…" />;
  }

  // The teaching week and its parity matter only on school days (rotating subjects).
  const schoolDay = data?.semesterStart && schoolDayOf(now, calendar).kind === 'school';
  const week = schoolDay ? getWeekNumber(data.semesterStart, now) : null;
  const parity = schoolDay ? getWeekParity(data.semesterStart, now) : null;
  const lunchEnd = (state && hasRail(state) && rail?.segments.find((segment) => segment.kind === 'lunch')?.end) || DEFAULT_LUNCH_END;

  return (
    <>
      {/* 設定 opens from the user's class, the setting 今天 depends on most. */}
      <HeaderActions
        right={[
          {
            kind: 'text',
            key: 'settings',
            label: userClass || '班級',
            accessibilityLabel: userClass ? `設定，目前班級 ${userClass}` : '設定，尚未選擇班級',
            onPress: () => router.push('/settings'),
          },
        ]}
      />
      {/*
        Pull to refresh reloads the bell times and timetables, the 行事曆 and
        the commute. onRefresh from the first render: the iOS List is rebuilt
        if it appears later.
      */}
      <ListScreen
        subtitle={todayHeading(now, week, parity)}
        onRefresh={() => Promise.allSettled([timetable.refetch(), school.refetch(), commute.refetch(), announcements.refetch()])}>
        <Section plain>{card}</Section>
        <AnnouncementsSection announcements={announcements} />
        {widgets.todo ? <AgendaSection now={now} calendar={calendar} /> : null}
        {widgets.lunch ? <LunchSection now={now} calendar={calendar} lunchEnd={lunchEnd} /> : null}
        {/* Before and after school the card carries the commute itself. */}
        {widgets.commute && details.length === 0 ? <CommuteSection lines={commute.lines} live={commuteTime} /> : null}
        {widgets.news ? <PinnedSection /> : null}
      </ListScreen>
    </>
  );
}
