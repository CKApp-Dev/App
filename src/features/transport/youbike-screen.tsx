// Saved YouBike stations, with live availability and station management.
import { router } from 'expo-router';
import { useMemo } from 'react';

import { HeaderActions } from '@/components/header-actions';
import { icons } from '@/components/icons';
import { useTransportStore, type FollowedYoubike } from '@/store/transport';
import { EmptyState, ListScreen, MetricPills, Row, Section } from '@/ui';

import { availabilityPills } from './availability-pills';
import { confirmRemoval } from './confirm-remove';
import { citiesOf, followedStationView, stationKey, youbikeFooter } from './transport-view';
import { refetchYoubike, useYoubikeFeeds } from './use-transport-queries';
import { useTransportRefresh } from './use-transport-refresh';
import type { YoubikeStation } from './youbike';

const YOUBIKE_HINT = process.env.EXPO_OS === 'ios' ? '左滑或長按站點即可修改暱稱或移除。' : '';

function openYoubikePicker() {
  router.push('/youbike-picker');
}

function openRename(follow: FollowedYoubike) {
  router.push({ pathname: '/youbike-rename', params: { city: follow.city, sna: follow.sna } });
}

export default function YoubikeScreen() {
  const followed = useTransportStore((state) => state.youbike);
  const unfollowYoubike = useTransportStore((state) => state.unfollowYoubike);
  const cities = useMemo(() => citiesOf(followed), [followed]);
  const feeds = useYoubikeFeeds(cities);
  const taipeiData = feeds['臺北市'].data;
  const newTaipeiData = feeds['新北市'].data;
  const stations = useMemo(() => {
    const byKey = new Map<string, YoubikeStation>();
    for (const station of [...(taipeiData ?? []), ...(newTaipeiData ?? [])]) byKey.set(stationKey(station), station);
    return byKey;
  }, [taipeiData, newTaipeiData]);
  const { refreshing, refresh } = useTransportRefresh(() => refetchYoubike(feeds, cities));

  return (
    <>
      <HeaderActions
        right={[
          {
            kind: 'icon',
            key: 'refresh',
            label: '更新 YouBike 資訊',
            icon: icons.refresh,
            disabled: refreshing,
            onPress: () => void refresh(),
          },
          {
            kind: 'icon',
            key: 'add',
            label: '新增 YouBike 站點',
            icon: icons.add,
            onPress: openYoubikePicker,
          },
        ]}
      />
      <ListScreen
        onRefresh={refresh}
        refreshing={refreshing}
        fab={{ label: '新增 YouBike 站點', icon: icons.add, onPress: openYoubikePicker }}>
        {followed.length === 0 ? (
          <Section title="YouBike 站點" plain>
            <EmptyState
              icon={icons.bike}
              title="尚未加入站點"
              description="新增常用站點後，即可查看可借車輛與可還車位。"
              action={{ label: '新增 YouBike 站點', onPress: openYoubikePicker }}
            />
          </Section>
        ) : (
          <Section
            title="YouBike 站點"
            footer={[
              youbikeFooter(followed.map((follow) => stations.get(stationKey(follow)))),
              YOUBIKE_HINT,
            ].filter(Boolean).join('\n')}>
            {followed.map((follow) => {
              const station = stations.get(stationKey(follow));
              const view = followedStationView(follow, station, feeds[follow.city]);
              return (
                <Row
                  key={stationKey(follow)}
                  title={follow.nickname}
                  subtitle={view.subtitle}
                  footer={view.showCounts ? <MetricPills metrics={availabilityPills(station)} /> : undefined}
                  actions={[
                    { key: 'rename', label: '修改暱稱', icon: icons.edit, onPress: () => openRename(follow) },
                    {
                      key: 'remove',
                      label: '移除站點',
                      icon: icons.delete,
                      destructive: true,
                      onPress: () =>
                        confirmRemoval('移除站點', follow.nickname, () => unfollowYoubike(follow.sna, follow.city)),
                    },
                  ]}
                />
              );
            })}
          </Section>
        )}
      </ListScreen>
    </>
  );
}
