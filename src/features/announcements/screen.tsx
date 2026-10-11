import { router } from "expo-router";

import { ListScreen, Loading, Notice, Row, Section, TextBlock } from "@/ui";

import { formatAnnouncementDate } from "./model";
import { useAnnouncementReadState } from "./read-state";
import { useAnnouncements } from "./use-announcements";

export default function AnnouncementsScreen() {
  const announcements = useAnnouncements();
  const readIds = useAnnouncementReadState((state) => state.readIds);
  return (
    <ListScreen onRefresh={announcements.refetch}>
      <Section title="班聯公告" footer="顯示最近 50 則已發布公告">
        {!announcements.configured ? (
          <TextBlock text="公告暫未開放" secondary />
        ) : announcements.error ? (
          <Notice
            tone="error"
            title="公告目前無法更新"
            action={{
              label: "重試",
              onPress: () => void announcements.refetch(),
            }}
          />
        ) : announcements.loading ? (
          <Loading label="正在載入公告…" />
        ) : null}
        {announcements.data.map((item) => (
          <Row
            key={item.id}
            title={item.title}
            titleLines={3}
            subtitle={formatAnnouncementDate(item.publishAt)}
            strong={!readIds.includes(item.id)}
            badge={readIds.includes(item.id) ? undefined : "未讀"}
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
        !announcements.error &&
        !announcements.loading &&
        announcements.data.length === 0 ? (
          <TextBlock text="目前沒有公告" secondary />
        ) : null}
      </Section>
    </ListScreen>
  );
}
