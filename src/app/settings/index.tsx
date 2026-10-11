import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { HeaderActions } from '@/components/header-actions';
import { NotificationSettings } from '@/features/announcements/notification-settings';
import { useTimetables } from '@/features/schedule/use-timetables';
import { GRADE_LABELS, gradeOfClass } from '@/features/todo/school-days';
import { doneHeader } from '@/features/todo/editor-header';
import { confirmPickerChange } from '@/hooks/use-confirmed-picker';
import { queryClient } from '@/lib/query-client';
import { useFoodStore } from '@/store/food';
import { useNewsStore } from '@/store/news';
import { useScheduleStore } from '@/store/schedule';
import { useSettingsStore, type HomeWidgets } from '@/store/settings';
import { useTodoStore } from '@/store/todo';
import { useTransportStore } from '@/store/transport';
import {
  ButtonRow,
  ListScreen,
  Loading,
  Notice,
  PickerRow,
  Row,
  Section,
  ToggleRow,
} from '@/ui';

const VERSION = Constants.expoConfig?.version;

const HOME_WIDGETS: readonly { key: keyof HomeWidgets; label: string }[] = [
  { key: 'todo', label: '今日待辦與活動' },
  { key: 'lunch', label: '午餐' },
  { key: 'commute', label: '回家' },
  { key: 'news', label: '釘選的校網消息' },
];

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const timetable = useTimetables();
  const userClass = useScheduleStore((state) => state.userClass);
  const grade = gradeOfClass(userClass);
  const calendarGradeOnly = useSettingsStore((state) => state.calendarGradeOnly);
  const setCalendarGradeOnly = useSettingsStore((state) => state.setCalendarGradeOnly);

  const classIds = timetable.data
    ? Array.from(new Set(userClass ? [userClass, ...timetable.data.classIds] : timetable.data.classIds)).sort()
    : null;
  const classOptions = classIds
    ? [
        // PickerRow always shows `value`, so until a class is chosen that is 尚未選擇.
        ...(userClass === '' ? [{ label: '尚未選擇', value: '' }] : []),
        ...classIds.map((id) => ({ label: id, value: id })),
      ]
    : null;

  function changeClass(id: string) {
    if (id === userClass) return;
    const rows = timetable.data?.byClass[id];
    // Nothing to switch to. PickerRow always shows `value`, so leaving
    // userClass alone puts the picker back on it.
    if (!rows) return;
    // With no timetable there are no edits to lose, so nothing to confirm. The
    // rows decide, not the class: an import whose class could not be read
    // still brings the previous app's edited rows, which a first pick replaces.
    if (useScheduleStore.getState().rows.length === 0) {
      useScheduleStore.getState().setClass(id, rows);
      return;
    }
    confirmPickerChange(
      `更改為 ${id} 班？`,
      '更改班級會取代自訂科目、備註及顏色。',
      { text: '更改', onPress: () => useScheduleStore.getState().setClass(id, rows) },
      // Declined: userClass is unchanged and PickerRow snaps back to it.
      () => {},
    );
  }

  function reloadClasses() {
    void timetable.refetch();
  }

  // Pull to refresh retries a class list that failed or went stale. It is
  // passed from the first render: the iOS kit rebuilds the List when
  // `refreshable` first appears.
  return (
    <>
      <HeaderActions {...doneHeader(() => router.back())} />
      <ListScreen onRefresh={() => timetable.refetch()}>
        <Section title="我的班級" footer="換班級會載入那一班的課表。">
          {classOptions ? (
            <PickerRow label="班級" value={userClass} options={classOptions} onChange={changeClass} />
          ) : timetable.isError ? (
            <Notice tone="error" title="無法載入班級列表。" action={{ label: '重新載入', onPress: reloadClasses }} />
          ) : (
            <>
              <Loading label="正在載入班級…" />
              {/* A paused (offline) load would otherwise spin with no way to retry. */}
              <ButtonRow label="重新載入" onPress={reloadClasses} />
            </>
          )}
        </Section>

        <Section title="「今天」顯示" footer="最上方的「現在」卡片會一直顯示。">
          {HOME_WIDGETS.map(({ key, label }) => (
            <ToggleRow
              key={key}
              label={label}
              value={settings.homeWidgets[key]}
              onValueChange={(value) => settings.setHomeWidget(key, value)}
            />
          ))}
        </Section>

        <Section title="行事曆">
          <ToggleRow
            label={grade ? `只顯示和${GRADE_LABELS[grade]}有關的學校活動` : '只顯示和自己年級有關的學校活動'}
            value={calendarGradeOnly}
            onValueChange={setCalendarGradeOnly}
          />
        </Section>

        <NotificationSettings />

        <Section title="資料" footer="會清除課表修改、待辦、最愛與常用站點，無法復原。下載的校務資料與網站登入會保留。">
          <ButtonRow label="重設個人資料與設定" role="destructive" onPress={confirmReset} />
        </Section>

        <Section>
          <Row title="關於 CK APP" detail={VERSION} accessory="chevron" onPress={() => router.push('/settings/about')} />
        </Section>
      </ListScreen>
    </>
  );
}

function confirmReset() {
  Alert.alert('重設個人資料與設定？', '自訂課表、活動、待辦、釘選、收藏、追蹤車站及設定會刪除，無法復原。', [
    { text: '取消', style: 'cancel' },
    { text: '清除', style: 'destructive', onPress: resetEverything },
  ]);
}

/**
 * Puts every store back to its initial state and starts over on 你是哪一班？,
 * as a new install does. The six resets run together in one task on purpose:
 * that is how the legacy import (features/legacy-import/session.ts)
 * recognises "start over" and gives up an import still owed, so the previous
 * app's data cannot arrive afterwards.
 */
function resetEverything() {
  void queryClient.cancelQueries();
  useScheduleStore.getState().reset();
  useTodoStore.getState().reset();
  useNewsStore.getState().reset();
  useFoodStore.getState().reset();
  useTransportStore.getState().reset();
  useSettingsStore.getState().reset();
  queryClient.clear();
  // Only closing the sheet would leave 今天 up with no class, and the welcome
  // screen the reset re-armed would wait for the next launch: index.tsx
  // decides on it only when it mounts. So pop the root stack back to (tabs)
  // (this is the sheet stack's first screen, so the pop bubbles up to the
  // root) and replace that with "/", which now redirects to /welcome.
  router.dismissAll();
  router.replace('/');
}
