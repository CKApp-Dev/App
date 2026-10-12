// 美食 › 附近: restaurants near 建中 on a map and in a list (nearest first),
// with their opening status, name search, 營業中 / 我的最愛 filters,
// favourites and a random pick, each restaurant opening the /restaurant
// modal. Layout per docs/design/native-ui.md, "美食 (Food)".
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactElement } from 'react';
import { Alert, useWindowDimensions } from 'react-native';

import { HeaderActions, type HeaderItem } from '@/components/header-actions';
import { icons } from '@/components/icons';
import { useNow } from '@/features/home/use-now';
import { clock, minutesOfDay } from '@/lib/dates';
import { useFoodStore } from '@/store/food';
import { usePalette } from '@/theme/palette';
import { Embedded, EmptyState, FilterChips, ListScreen, Loading, Notice, Row, Section } from '@/ui';

import {
  distanceLabel,
  FILTER_LABELS,
  filterRestaurants,
  metresFromSchool,
  openNearSchool,
  pickRandomOpen,
  splitName,
  statusLine,
} from './food-view';
import { MAP_AVAILABLE } from './map-availability';
import type { Restaurant } from './opening-hours';
import RestaurantMap from './restaurant-map';
import { useRestaurants } from './use-restaurants';

const ANDROID = process.env.EXPO_OS === 'android';

/** Statuses are minute-resolution; the clock only ticks while 美食 is focused. */
const CLOCK_INTERVAL_MS = 30_000;

/** The map takes about 40% of the screen height, leaving the list's first rows in view. */
const MAP_HEIGHT_RATIO = 0.4;
const MIN_MAP_HEIGHT = 220;

/** The favourite heart's colour (systemPink). */
const HEART = '#FF2D55';

/** `switcher`: the 美食 tab's 熱食部 / 附近 control, first in the navigation bar (see ./tab.tsx). */
export default function FoodScreen({ switcher }: { switcher?: HeaderItem }) {
  const now = useNow(CLOCK_INTERVAL_MS);
  const palette = usePalette();
  const { height: windowHeight } = useWindowDimensions();
  const restaurants = useRestaurants();
  const favorites = useFoodStore((state) => state.favorites);
  const toggleFavorite = useFoodStore((state) => state.toggleFavorite);
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // The restaurant just opened, so the map pans to it behind the modal.
  const [selected, setSelected] = useState<Restaurant | null>(null);

  // Cleared once the modal closes (as the old sheet's onDismiss did): a map
  // mounted later (顯示地圖) then starts at its overview instead of zooming to
  // a stale pick, and opening the same restaurant again pans to it again.
  useFocusEffect(useCallback(() => setSelected(null), []));

  const data = restaurants.data;
  const filtered = filterRestaurants(data ?? [], { query, openOnly, favoritesOnly }, favorites, now);
  const filtering = openOnly || favoritesOnly;
  const refresh = () => restaurants.refetch();

  function openDetail(restaurant: Restaurant) {
    setSelected(restaurant);
    router.push({ pathname: '/restaurant', params: { name: restaurant.name } });
  }

  function chooseRandom() {
    // From what the list shows (search and filters apply), open ones only.
    const choice = pickRandomOpen(filtered, now);
    if (!choice) {
      Alert.alert('目前沒有營業中的餐廳', '調整篩選條件後再試一次。');
      return;
    }
    openDetail(choice);
  }

  function toggleFilter(key: string) {
    if (key === 'open') setOpenOnly((on) => !on);
    else if (key === 'favorites') setFavoritesOnly((on) => !on);
  }

  function clearFilters() {
    setOpenOnly(false);
    setFavoritesOnly(false);
  }

  const header: HeaderItem[] = [
    ...(switcher ? [switcher] : []),
    ...(MAP_AVAILABLE
      ? [{
          kind: 'icon' as const,
          key: 'full-map',
          label: '顯示完整美食地圖',
          icon: icons.map,
          onPress: () => router.push({ pathname: '/food-map' }),
        }]
      : []),
    {
      kind: 'icon',
      key: 'random',
      label: '隨機選擇營業中的餐廳',
      icon: icons.dice,
      disabled: !filtered.length,
      onPress: chooseRandom,
    },
  ];
  const openCount = data ? openNearSchool(data, now).length : null;

  let listSection: ReactElement;
  if (data && filtered.length > 0) {
    // Nearest first: what students weigh between classes.
    const listed = filtered
      .map((restaurant) => ({ restaurant, metres: metresFromSchool(restaurant.position) }))
      .sort((a, b) => a.metres - b.metres);
    listSection = (
      <Section title="由近到遠" detail="距離從學校算起" footer="直線距離，從建中東側門算起。">
        {listed.map(({ restaurant, metres }) => {
          const status = statusLine(restaurant, now);
          const { name, aside } = splitName(restaurant.name);
          const favorite = favorites.includes(restaurant.name);
          const subtitle = `${status.text} · ${distanceLabel(metres)}`;
          return (
            <Row
              key={restaurant.name}
              title={name}
              titleAside={aside ?? undefined}
              subtitle={subtitle}
              subtitleDotColor={status.color}
              accessibilityLabel={[restaurant.name, favorite ? FILTER_LABELS.favorites : null, subtitle]
                .filter(Boolean)
                .join('，')}
              toggle={{
                label: favorite ? '移除最愛' : '加入最愛',
                icon: icons.favorite,
                activeIcon: icons.favoriteFilled,
                active: favorite,
                onPress: () => toggleFavorite(restaurant.name),
                button: true,
                activeColor: HEART,
              }}
              onPress={() => openDetail(restaurant)}
            />
          );
        })}
      </Section>
    );
  } else if (data) {
    listSection = (
      <Section plain>
        <EmptyState
          icon={icons.forkKnife}
          title="沒有符合條件的餐廳。"
          description="試試其他關鍵字，或關閉篩選條件。"
          // The search text lives in the native search bar; the filters are
          // the part that is easy to forget when they sit in a menu.
          action={filtering ? { label: '關閉篩選條件', onPress: clearFilters } : undefined}
        />
      </Section>
    );
  } else if (restaurants.isError) {
    listSection = (
      <Section plain>
        <EmptyState
          icon={icons.offline}
          title="無法讀取餐廳資料"
          description="請檢查網路後再試一次。"
          action={{ label: '重新讀取', onPress: () => void refresh() }}
        />
      </Section>
    );
  } else {
    listSection = (
      <Section>
        <Loading label="正在讀取餐廳資料…" />
      </Section>
    );
  }

  return (
    <>
      <Stack.SearchBar
        placeholder="搜尋餐廳或綽號，例如「林乾」"
        // The SwiftUI list inside the Host does not drive UIKit's
        // hide-on-scroll, which could leave the bar unreachable.
        hideWhenScrolling={false}
        // Results filter as you type, so keep them visible and tappable.
        obscureBackground={false}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        // iOS clears the field on 取消 without a change event; Android
        // clears it when the search view collapses.
        onCancelButtonPress={() => setQuery('')}
        onClose={() => setQuery('')}
        // Android's search view takes the top app bar's colours, like the
        // HeaderActions icons beside it (iOS draws system colours itself).
        {...(ANDROID
          ? { textColor: palette.text, hintTextColor: palette.textSecondary, headerIconColor: palette.textSecondary }
          : null)}
      />
      <HeaderActions right={header} />
      <ListScreen
        subtitle={['附近', clock(minutesOfDay(now)), openCount !== null ? `${openCount} 間營業中` : ''].filter(Boolean).join(' · ')}
        onRefresh={refresh}>
        {/* Cached restaurants stay on screen when a refresh fails. */}
        {data && restaurants.isError ? (
          <Section>
            <Notice
              tone="error"
              title="無法更新餐廳資料"
              message="先顯示上次儲存的內容。"
              action={{ label: '重新讀取', onPress: () => void refresh() }}
            />
          </Section>
        ) : null}

        <Section plain>
          <FilterChips
            options={[
              { key: 'open', label: FILTER_LABELS.open, selected: openOnly },
              { key: 'favorites', label: FILTER_LABELS.favorites, selected: favoritesOnly },
            ]}
            onToggle={toggleFilter}
          />
        </Section>

        {MAP_AVAILABLE ? (
          <Section>
            <Embedded height={Math.max(MIN_MAP_HEIGHT, Math.round(windowHeight * MAP_HEIGHT_RATIO))}>
              <RestaurantMap restaurants={filtered} selected={selected} now={now} onSelect={openDetail} />
            </Embedded>
          </Section>
        ) : null}

        {listSection}
      </ListScreen>
    </>
  );
}
