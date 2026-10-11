import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { openWebsite } from '@/lib/open-link';
import { ButtonRow, ListScreen, Loading, Notice, Section, TextBlock } from '@/ui';

import { formatAnnouncementDate } from './model';
import { useAnnouncementReadState } from './read-state';
import { useAnnouncement } from './use-announcements';

export default function AnnouncementDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const announcement = useAnnouncement(id);
  const markRead = useAnnouncementReadState((state) => state.markRead);
  useEffect(() => { if (announcement.data) markRead(announcement.data.id); }, [announcement.data, markRead]);
  return (
    <ListScreen>
      <Section>
        {announcement.loading ? <Loading label="正在載入公告…" />
          : announcement.data ? <>
            <TextBlock text={announcement.data.title} size="large" selectable />
            <TextBlock text={`發布於 ${formatAnnouncementDate(announcement.data.publishAt)}`} secondary />
            <TextBlock text={announcement.data.body} selectable />
            {announcement.data.url ? <ButtonRow label="查看相關連結" onPress={() => void openWebsite(announcement.data!.url)} /> : null}
          </> : <Notice tone="info" title="目前無法查看這則公告" message="公告可能已下架，或暫時無法連線。"
            action={announcement.configured ? { label: '重試', onPress: announcement.retry } : undefined} />}
      </Section>
    </ListScreen>
  );
}
