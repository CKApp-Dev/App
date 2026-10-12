// Saved Metro stations, with live arrivals and car crowding.
import { router } from 'expo-router';

import { HeaderActions } from '@/components/header-actions';
import { icons } from '@/components/icons';
import { useTransportStore } from '@/store/transport';
import { EmptyState, ListScreen, Section } from '@/ui';

import { confirmRemoval } from './confirm-remove';
import { metroMessages, metroStationRows } from './metro-content';
import { metroFooter } from './transport-view';
import { useMetroLive } from './use-transport-queries';
import { useTransportRefresh } from './use-transport-refresh';

const METRO_HINT = process.env.EXPO_OS === 'ios' ? '左滑或長按車站即可移除。' : '';

function openMetroPicker() {
  router.push('/metro-picker');
}

export default function MetroScreen() {
  const stations = useTransportStore((state) => state.metro);
  const removeMetro = useTransportStore((state) => state.removeMetro);
  const metro = useMetroLive(stations.length > 0);
  const { refreshing, refresh } = useTransportRefresh(metro.refetch);

  return (
    <>
      <HeaderActions
        right={[
          {
            kind: 'icon',
            key: 'refresh',
            label: '更新捷運資訊',
            icon: icons.refresh,
            disabled: refreshing,
            onPress: () => void refresh(),
          },
          {
            kind: 'icon',
            key: 'add',
            label: '新增捷運車站',
            icon: icons.add,
            onPress: openMetroPicker,
          },
        ]}
      />
      <ListScreen
        onRefresh={refresh}
        refreshing={refreshing}
        fab={{ label: '新增捷運車站', icon: icons.add, onPress: openMetroPicker }}>
        <Section
          title="捷運車站"
          plain={stations.length === 0}
          footer={stations.length ? [
            metroFooter(metro.configured, metro.tracks.dataUpdatedAt),
            METRO_HINT,
          ].filter(Boolean).join('\n') || undefined : undefined}>
          {metroMessages(metro, stations.length)}
          {stations.length === 0 ? (
            <EmptyState
              icon={icons.metro}
              title="尚未加入捷運車站"
              action={{ label: '新增捷運車站', onPress: openMetroPicker }}
            />
          ) : null}
          {stations.map((station) => metroStationRows(station, metro, {
            actions: [{
              key: 'remove',
              label: '移除車站',
              icon: icons.delete,
              destructive: true,
              onPress: () => confirmRemoval('移除車站', station, () => removeMetro(station)),
            }],
          }))}
        </Section>
      </ListScreen>
    </>
  );
}
