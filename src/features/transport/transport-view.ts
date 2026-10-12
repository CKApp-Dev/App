// What 交通 and its pickers show, as pure functions of the feeds: labels,
// status lines, availability and crowding colours. The screens stay
// declarative and this stays unit-tested (transport-view.test.ts).
import {
  arrivalsAt,
  carCrowdedness,
  CROWD_COLORS,
  CROWD_LABELS,
  crowdLevel,
  destinationLabel,
  parseCountdown,
  trainLineColor,
  type CarWeight,
  type TrackInfo,
} from './metro';
import { linesOfStation, METRO_LINE_COLORS, METRO_LINE_NAMES } from './metro-lines';
import {
  availabilityLevel,
  CITIES,
  stationDisplayName,
  type AvailabilityLevel,
  type City,
  type StationWithDistance,
  type YoubikeStation,
} from './youbike';

/** Live data refreshes this often while the screen showing it is focused. */
export const POLL_MS = 10_000;

/** Grey for counts and cars the feeds did not report. */
export const UNKNOWN_COLOR = '#777777';

// Taiwan has kept UTC+8 all year since 1979, so a fixed offset is exact and
// avoids Intl quirks (some engines print midnight as 24:00:00 with hour12 off).
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "HH:MM:SS" in Taipei time, whatever the phone's time zone. */
export function taipeiTime(at: number | Date): string {
  const shifted = new Date(new Date(at).getTime() + TAIPEI_OFFSET_MS);
  return [shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

// MARK: - YouBike

/** Identifies a station across both cities (names can repeat between them). */
export function stationKey(station: { city: City; sna: string }): string {
  return `${station.city}:${station.sna}`;
}

/** The cities `stations` are in, in CITIES order. */
export function citiesOf(stations: readonly { city: City }[]): City[] {
  return CITIES.filter((city) => stations.some((station) => station.city === city));
}

const AVAILABILITY_COLORS: Record<AvailabilityLevel, string> = {
  none: '#C62828',
  low: '#EF6C00',
  ok: '#238545',
  unknown: UNKNOWN_COLOR,
};

export function availabilityColor(count: number | null): string {
  return AVAILABILITY_COLORS[availabilityLevel(count)];
}

export interface AvailabilityMetric {
  key: 'rent' | 'dock';
  label: string;
  color: string;
}

/** 可借 N / 可還 N, coloured by how many are left; 未知 when not reported. */
export function availabilityMetrics(station: Pick<YoubikeStation, 'rent' | 'return'> | undefined): AvailabilityMetric[] {
  const rent = station?.rent ?? null;
  const docks = station?.return ?? null;
  return [
    { key: 'rent', label: `可借 ${rent ?? '未知'}`, color: availabilityColor(rent) },
    { key: 'dock', label: `可還 ${docks ?? '未知'}`, color: availabilityColor(docks) },
  ];
}

/** The parts of a react-query result the status lines depend on. */
export interface FeedState {
  /** No data yet (the first load is under way). */
  isPending: boolean;
  isError: boolean;
}

export interface FollowedStationView {
  /** `城市 · 站名`, then the status line and the station's own report time. */
  subtitle: string;
  /** False while the first load is under way: there are no counts to show yet. */
  showCounts: boolean;
}

/**
 * A followed station's row. `station` is its entry in the city's feed, which
 * is missing while loading, after a failed first load, or when the feed does
 * not list it (a station that stopped reporting).
 */
export function followedStationView(
  follow: { city: City; sna: string },
  station: YoubikeStation | undefined,
  feed: FeedState,
): FollowedStationView {
  let status: string | null = null;
  if (feed.isPending) status = '正在載入即時資訊…';
  else if (feed.isError) status = station ? '更新失敗，顯示上次取得的資訊。' : '更新失敗，請下拉重試。';
  else if (!station) status = '此站點目前沒有回報資料。';

  const lines = [`${follow.city} · ${stationDisplayName(follow.sna)}`];
  if (status) lines.push(status);
  if (station?.updatedAt) lines.push(`站點更新 ${taipeiTime(station.updatedAt)}`);
  return { subtitle: lines.join('\n'), showCounts: !feed.isPending };
}

/** The YouBike section footer, with the newest report among the followed stations. */
export function youbikeFooter(stations: readonly (YoubikeStation | undefined)[]): string {
  const latest = Math.max(...stations.map((station) => station?.updatedAt?.getTime() ?? Number.NEGATIVE_INFINITY));
  return Number.isFinite(latest) ? `約每 10 秒更新 · 站點更新 ${taipeiTime(latest)}` : '約每 10 秒更新';
}

/** The picker lists at most this many search results. */
export const SEARCH_LIMIT = 30;

/** Stations whose name or 行政區 contains `query`, capped at SEARCH_LIMIT. */
export function searchStations(stations: readonly YoubikeStation[], query: string): {
  results: YoubikeStation[];
  /** Matches before the cap. */
  total: number;
} {
  const text = query.trim();
  const matches = stations.filter((station) => `${stationDisplayName(station.sna)} ${station.area}`.includes(text));
  return { results: matches.slice(0, SEARCH_LIMIT), total: matches.length };
}

/** `臺北市 · 120 公尺` under a nearby station. */
export function nearbySubtitle(station: StationWithDistance): string {
  return `${station.city} · ${Math.round(station.distanceKm * 1000)} 公尺`;
}

// MARK: - Metro

/** Stations on a line whose name contains `query`, in route order. */
export function searchMetroStations(stations: readonly string[], query: string): string[] {
  const text = query.trim();
  return stations.filter((station) => station.includes(text));
}

export function countdownLabel(countDown: string): string {
  const value = parseCountdown(countDown);
  if (value.kind === 'arriving') return '列車進站';
  if (value.kind === 'closed') return '營運時間已過';
  if (value.kind === 'time') return `${value.minutes} 分 ${String(value.seconds).padStart(2, '0')} 秒`;
  return '暫無到站時間';
}

/** The lines serving a station, each with its colour (the station row's pills). */
export function lineMetrics(station: string): { key: string; label: string; color: string }[] {
  return linesOfStation(station).map((line) => ({
    key: line,
    label: METRO_LINE_NAMES[line],
    color: METRO_LINE_COLORS[line],
  }));
}

export interface CrowdView {
  levels: { key: string; color: string }[];
  /** The levels in words, so colour is not the only signal. */
  accessibilityLabel: string;
}

/** A train's cars (front first) as coloured levels and a spoken summary; null without data. */
export function crowdView(levels: readonly number[]): CrowdView | null {
  if (!levels.length) return null;
  return {
    levels: levels.map((level, index) => ({
      key: String(index),
      color: Number.isFinite(level) ? CROWD_COLORS[crowdLevel(level)] : UNKNOWN_COLOR,
    })),
    accessibilityLabel: `車廂擁擠程度，前車廂起：${levels
      .map((level) => (Number.isFinite(level) ? CROWD_LABELS[crowdLevel(level)] : '未知'))
      .join('、')}`,
  };
}

export interface TrainView {
  key: string;
  /** 往 X */
  title: string;
  /** The countdown. */
  detail: string;
  lineColor: string;
  crowd: CrowdView | null;
}

/** The trains approaching `station`, with their line colour and crowding. */
export function trainViews(tracks: TrackInfo[], weights: CarWeight[], station: string): TrainView[] {
  return arrivalsAt(tracks, station).map((train, index) => ({
    key: `${train.TrainNumber}:${train.DestinationName}:${index}`,
    title: `往 ${destinationLabel(train.DestinationName)}`,
    detail: countdownLabel(train.CountDown),
    lineColor: trainLineColor(train.DestinationName, station, train.TrainNumber) ?? UNKNOWN_COLOR,
    crowd: crowdView(carCrowdedness(weights, train.TrainNumber)),
  }));
}

/**
 * The status line under a Metro station: loading, or no trains reported. A
 * failed load is explained once for the whole section instead.
 */
export function metroStationStatus(options: {
  configured: boolean;
  isPending: boolean;
  hasData: boolean;
  trainCount: number;
}): string | undefined {
  if (!options.configured) return undefined;
  if (options.isPending) return '正在載入到站資訊…';
  if (options.hasData && options.trainCount === 0) return '此站目前沒有到站資訊。';
  return undefined;
}

export interface MetroNotices {
  /** No credentials: arrivals are off, but stations can still be managed. */
  notConfigured: boolean;
  /** Arrivals failed to load or refresh. */
  arrivalsFailed: boolean;
  /** Crowding failed while arrivals are shown. */
  crowdingFailed: boolean;
}

/**
 * The notices above the Metro stations. Failures are reported only while
 * nearby or followed stations are requested: with none, nothing is fetched,
 * so an old error would stay on screen and retrying could not clear it.
 */
export function metroNotices(state: {
  configured: boolean;
  stationCount: number;
  arrivals: { isError: boolean; hasData: boolean };
  crowdingError: boolean;
}): MetroNotices {
  const live = state.configured && state.stationCount > 0;
  return {
    notConfigured: !state.configured,
    arrivalsFailed: live && state.arrivals.isError,
    crowdingFailed: live && state.crowdingError && state.arrivals.hasData,
  };
}

export const CROWD_LEGEND ='車廂擁擠：綠色低、黃色中、橘色高、深橘色極高（前車廂起）。';

/** The Metro section footer: the crowding legend and when arrivals were fetched. */
export function metroFooter(configured: boolean, updatedAt: number): string | undefined {
  if (!configured) return undefined;
  return updatedAt > 0 ? `${CROWD_LEGEND}\n到站資訊更新 ${taipeiTime(updatedAt)}` : CROWD_LEGEND;
}
