// Shared native rows and notices for nearby and saved Metro stations. Keep
// the rows in a Fragment so Android's Section can insert its row dividers.
import { Fragment } from 'react';

import { icons } from '@/components/icons';
import { CrowdBar, MetricPills, Notice, Row, type RowAction } from '@/ui';

import { lineMetrics, metroNotices, metroStationStatus, trainViews } from './transport-view';
import type { MetroLive } from './use-transport-queries';

export function metroStationRows(
  station: string,
  metro: MetroLive,
  options: { distanceKm?: number; actions?: RowAction[] } = {},
) {
  const trains = metro.configured ? trainViews(metro.tracks.data ?? [], metro.weights.data ?? [], station) : [];
  const status = metroStationStatus({
    configured: metro.configured,
    isPending: metro.tracks.isPending,
    hasData: metro.tracks.data !== undefined,
    trainCount: trains.length,
  });
  return (
    <Fragment key={station}>
      <Row
        title={station}
        subtitle={status}
        detail={options.distanceKm === undefined ? undefined : `${Math.round(options.distanceKm * 1000)} 公尺`}
        icon={icons.metro}
        footer={<MetricPills metrics={lineMetrics(station)} />}
        actions={options.actions}
      />
      {trains.map((train) => (
        <Row
          key={train.key}
          title={train.title}
          detail={train.detail}
          dotColor={train.lineColor}
          footer={train.crowd ? (
            <CrowdBar levels={train.crowd.levels} accessibilityLabel={train.crowd.accessibilityLabel} />
          ) : undefined}
        />
      ))}
    </Fragment>
  );
}

export function metroMessages(metro: MetroLive, stationCount: number) {
  const notices = metroNotices({
    configured: metro.configured,
    stationCount,
    arrivals: { isError: metro.tracks.isError, hasData: metro.tracks.data !== undefined },
    crowdingError: metro.weights.isError,
  });
  return (
    <>
      {notices.notConfigured ? (
        <Notice tone="info" title="捷運即時到站資訊暫未啟用" message="你仍可管理常用車站。" />
      ) : null}
      {notices.arrivalsFailed ? (
        <Notice
          tone="error"
          title="捷運更新失敗"
          message={metro.tracks.data ? '顯示上次取得的到站資訊。' : '請下拉重試。'}
          action={{ label: '重試', onPress: () => void metro.refetch() }}
        />
      ) : null}
      {notices.crowdingFailed ? <Notice tone="info" title="車廂擁擠資訊目前無法更新" /> : null}
    </>
  );
}
