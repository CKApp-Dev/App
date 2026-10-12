// On-demand location lookup, three nearby YouBike stations and the nearest Metro.
import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { Linking } from 'react-native';

import { HeaderActions } from '@/components/header-actions';
import { icons } from '@/components/icons';
import { EmptyState, ListScreen, Loading, MetricPills, Notice, Row, Section } from '@/ui';

import { availabilityPills } from './availability-pills';
import { metroMessages, metroStationRows } from './metro-content';
import { nearestMetroStation } from './metro-stations';
import { metroFooter, nearbySubtitle, stationKey, youbikeFooter } from './transport-view';
import { refetchYoubike, useMetroLive, useYoubikeFeeds } from './use-transport-queries';
import { useTransportRefresh } from './use-transport-refresh';
import { CITIES, nearestStations, stationDisplayName, type YoubikeStation } from './youbike';

export default function NearbyTransportScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const cities = location ? CITIES : [];
  const feeds = useYoubikeFeeds(cities);
  const taipeiData = feeds['臺北市'].data;
  const newTaipeiData = feeds['新北市'].data;
  const stations = useMemo(() => {
    const byKey = new Map<string, YoubikeStation>();
    for (const station of [...(taipeiData ?? []), ...(newTaipeiData ?? [])]) byKey.set(stationKey(station), station);
    return [...byKey.values()];
  }, [taipeiData, newTaipeiData]);
  const nearestYoubike = useMemo(() => location
    ? nearestStations(stations, location.coords.latitude, location.coords.longitude, 3)
    : [], [location, stations]);
  const nearestMetro = location
    ? nearestMetroStation(location.coords.latitude, location.coords.longitude)
    : undefined;
  const metro = useMetroLive(nearestMetro !== undefined);
  const nearbyYoubikeLoading = CITIES.some((city) => feeds[city].isPending);
  const nearbyYoubikeFailed = CITIES.some((city) => feeds[city].isError);
  const { refreshing, refresh } = useTransportRefresh(() =>
    Promise.allSettled([refetchYoubike(feeds, cities), metro.refetch()]));

  async function locateUser() {
    if (locating) return;
    setLocating(true);
    setLocationError(null);
    try {
      if (!await Location.hasServicesEnabledAsync()) {
        setLocationError('定位服務尚未開啟，請在系統設定中開啟後再試。');
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationError('需要允許定位權限，才能尋找附近站點。');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(current);
    } catch (error) {
      console.warn('[transport] Unable to obtain location:', error);
      setLocationError('目前無法取得位置，請確認定位訊號後再試。');
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <HeaderActions
        right={[
          {
            kind: 'icon',
            key: 'refresh',
            label: '更新附近交通資訊',
            icon: icons.refresh,
            disabled: refreshing,
            onPress: () => void refresh(),
          },
          {
            kind: 'icon',
            key: 'locate',
            label: location ? '重新定位' : '尋找附近站點',
            icon: icons.location,
            disabled: locating,
            onPress: () => void locateUser(),
          },
        ]}
      />
      <ListScreen onRefresh={refresh} refreshing={refreshing}>
        <Section
          title="附近交通"
          action={locating ? undefined : {
            label: location ? '重新定位' : '尋找附近站點',
            onPress: () => void locateUser(),
          }}
          footer={location ? [
            '距離以直線距離計算',
            youbikeFooter(nearestYoubike),
            nearestMetro ? metroFooter(metro.configured, metro.tracks.dataUpdatedAt) : undefined,
          ].filter(Boolean).join('\n') : undefined}>
          {locating ? <Loading label="正在取得目前位置…" /> : null}
          {locationError ? (
            <Notice
              tone="error"
              title="無法取得位置"
              message={locationError}
              action={{ label: '開啟設定', onPress: () => void Linking.openSettings() }}
            />
          ) : null}
          {!locating && location && nearbyYoubikeLoading ? <Loading label="正在載入附近 YouBike 站點…" /> : null}
          {!locating && location && nearbyYoubikeFailed ? (
            <Notice
              tone="error"
              title="附近 YouBike 更新失敗"
              message="部分站點資訊可能不完整或不是最新，請下拉重試。"
              action={{ label: '重試', onPress: () => void refresh() }}
            />
          ) : null}
          {!locating && nearestYoubike.map((station) => (
            <Row
              key={stationKey(station)}
              title={stationDisplayName(station.sna)}
              subtitle={`YouBike · ${nearbySubtitle(station)}`}
              detail={`${Math.round(station.distanceKm * 1000)} 公尺`}
              icon={icons.bike}
              footer={<MetricPills metrics={availabilityPills(station)} />}
            />
          ))}
          {!locating && location && nearestYoubike.length === 0 && !nearbyYoubikeLoading && !nearbyYoubikeFailed ? (
            <Notice tone="info" title="附近沒有可用的 YouBike 站點資料" message="請稍後重新整理交通資訊。" />
          ) : null}
          {!locating && nearestMetro ? metroMessages(metro, 1) : null}
          {!locating && nearestMetro ? (
            metroStationRows(nearestMetro.name, metro, { distanceKm: nearestMetro.distanceKm })
          ) : null}
          {!locating && !location ? (
            <EmptyState
              icon={icons.location}
              title="顯示您附近的交通站點"
              description="只在您點選後使用目前位置，不會在背景持續定位。"
              action={{ label: '尋找附近站點', onPress: () => void locateUser() }}
            />
          ) : null}
        </Section>
      </ListScreen>
    </>
  );
}
