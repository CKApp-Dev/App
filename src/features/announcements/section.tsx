import { router } from "expo-router";

import { Row, Section, TextBlock, Loading, Notice, ButtonRow } from "@/ui";

import { formatAnnouncementDate } from "./model";
import { useAnnouncementReadState } from "./read-state";
import type { useAnnouncements } from "./use-announcements";
import { usePushSettings } from "./push";

export function AnnouncementsSection({
  announcements,
}: {
  announcements: ReturnType<typeof useAnnouncements>;
}) {
  const readIds = useAnnouncementReadState((state) => state.readIds);
  const unread = announcements.data.filter(
    (item) => !readIds.includes(item.id),
  ).length;
  const push = usePushSettings();
  return (
    <Section
      title="班聯公告"
      prominent
      titleBadge={unread > 0 ? `${unread} 則未讀` : undefined}
      action={
        announcements.configured
          ? { label: "全部", onPress: () => router.push("/announcements") }
          : undefined
      }
    >
      {!announcements.configured ? (
        <TextBlock text="公告暫未開放" secondary />
      ) : announcements.error ? (
        <Notice
          tone="error"
          title="公告目前無法更新"
          message="請檢查網路後重試"
          action={{
            label: "重試",
            onPress: () => void announcements.refetch(),
          }}
        />
      ) : announcements.loading ? (
        <Loading label="正在載入公告…" />
      ) : null}
      {announcements.data.slice(0, 3).map((item) => (
        <Row
          key={item.id}
          title={item.title}
          titleLines={3}
          subtitle={formatAnnouncementDate(item.publishAt)}
          note={item.body.slice(0, 80)}
          badge={readIds.includes(item.id) ? undefined : "未讀"}
          strong={!readIds.includes(item.id)}
          accessory="chevron"
          onPress={() =>
            router.push({
              pathname: "/announcements/[id]",
              params: { id: item.id },
            })
          }
        />
      ))}
      {announcements.configured &&
      !announcements.loading &&
      !announcements.error &&
      !announcements.data.length ? (
        <TextBlock text="目前沒有新公告" secondary />
      ) : null}
      {push.canEnable && !push.optedIn ? (
        <ButtonRow
          label="開啟公告通知"
          onPress={() => router.push("/settings")}
        />
      ) : null}
    </Section>
  );
}
