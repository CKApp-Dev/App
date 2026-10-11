import { ButtonRow, Notice, Section, TextBlock, ToggleRow } from '@/ui';

import { usePushSettings } from './push';

export function NotificationSettings() {
  const push = usePushSettings();
  return (
    <Section title="公告通知" footer="開啟後，有新公告時會透過裝置系統通知。首頁仍可閱讀所有已發布公告。">
      <ToggleRow label="接收新公告通知" value={push.optedIn} disabled={push.busy || (!push.canEnable && !push.optedIn)}
        onValueChange={(enabled) => void (enabled ? push.enable() : push.disable())} />
      {push.busy ? <TextBlock text="正在更新通知設定…" secondary /> : null}
      {push.status === 'unsupported' ? <TextBlock text="請在手機版 CK APP 開啟系統通知。" secondary /> : null}
      {push.status === 'unconfigured' ? <TextBlock text="此版本尚未開放系統通知。" secondary /> : null}
      {push.status === 'denied' ? <>
        <TextBlock text="系統目前未允許 CK APP 傳送通知。請到裝置設定開啟。" secondary />
        <ButtonRow label="開啟裝置設定" onPress={() => void push.openSettings()} />
      </> : null}
      {push.error ? <Notice tone="error" title="通知設定尚未完成" message={push.error}
        action={{ label: '重試', onPress: () => void (push.optedIn ? push.enable() : push.disable()) }} /> : null}
      {push.pendingSync ? <TextBlock text="關閉通知的設定尚待同步，恢復連線後會自動重試。" secondary /> : null}
    </Section>
  );
}
