// The live YouBike and Metro queries, shared by 交通, its picker sheets and
// 今天's 回家 so they read one cache (same query keys). Each hook only fetches,
// and polls (every 10 s unless the caller asks otherwise), while the screen
// calling it is focused: 交通 stops polling while a picker sheet covers it (or
// another tab is shown), and each screen asks only for the feeds it shows.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';

import { fetchCarWeights, fetchTrackInfo, hasMetroCredentials, type CarWeight, type TrackInfo } from './metro';
import { POLL_MS } from './transport-view';
import { fetchStations, type City, type YoubikeStation } from './youbike';

/** Data this recent counts as fresh: refocusing a screen (or opening a picker) within it does not fetch again. */
const STALE_MS = 5000;

export type YoubikeFeeds = Record<City, UseQueryResult<YoubikeStation[]>>;

export interface PollOptions {
  /** Whether to poll; without it the data is fetched on focus when older than `staleMs`. @default true */
  poll?: boolean;
  /** @default POLL_MS (10 s) */
  pollMs?: number;
  /** @default STALE_MS (5 s) */
  staleMs?: number;
}

function useCityStations(city: City, enabled: boolean, { poll = true, pollMs = POLL_MS, staleMs = STALE_MS }: PollOptions) {
  return useQuery({
    queryKey: ['transport', 'youbike', city],
    queryFn: ({ signal }) => fetchStations(city, signal),
    enabled,
    staleTime: staleMs,
    refetchInterval: enabled && poll ? pollMs : false,
  });
}

/**
 * Live stations of `cities`. The other city's feed is neither fetched nor
 * polled (New Taipei alone takes several paged requests), but keeps any data
 * another screen already loaded.
 */
export function useYoubikeFeeds(cities: readonly City[], options: PollOptions = {}): YoubikeFeeds {
  const focused = useIsFocused();
  const taipei = useCityStations('臺北市', focused && cities.includes('臺北市'), options);
  const newTaipei = useCityStations('新北市', focused && cities.includes('新北市'), options);
  return { 臺北市: taipei, 新北市: newTaipei };
}

/** Fetches `cities` again now; settles once every request has, failed or not. */
export function refetchYoubike(feeds: YoubikeFeeds, cities: readonly City[]): Promise<unknown> {
  return Promise.allSettled(cities.map((city) => feeds[city].refetch()));
}

export interface MetroLive {
  /** Whether the build has Metro API credentials; without them nothing is fetched. */
  configured: boolean;
  tracks: UseQueryResult<TrackInfo[]>;
  weights: UseQueryResult<CarWeight[]>;
  /** Fetches arrivals and crowding again now, when there is anything to fetch. */
  refetch: () => Promise<unknown>;
}

/** Live arrivals and car crowding, fetched while `needed` for nearby or followed stations. */
export function useMetroLive(needed: boolean, { poll = true, pollMs = POLL_MS, staleMs = STALE_MS }: PollOptions = {}): MetroLive {
  const focused = useIsFocused();
  const configured = hasMetroCredentials();
  const enabled = focused && configured && needed;
  const tracks = useQuery({
    queryKey: ['transport', 'metro', 'arrivals'],
    queryFn: ({ signal }) => fetchTrackInfo(signal),
    enabled,
    staleTime: staleMs,
    refetchInterval: enabled && poll ? pollMs : false,
  });
  const weights = useQuery({
    queryKey: ['transport', 'metro', 'crowding'],
    queryFn: ({ signal }) => fetchCarWeights(signal),
    enabled,
    staleTime: staleMs,
    refetchInterval: enabled && poll ? pollMs : false,
  });
  // refetch() ignores `enabled`, so it is guarded here: no credentials or no
  // stations means no request.
  const refetch = () => (enabled ? Promise.allSettled([tracks.refetch(), weights.refetch()]) : Promise.resolve());
  return { configured, tracks, weights, refetch };
}
