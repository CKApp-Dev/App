import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { HeaderActions, type HeaderActionsProps } from '@/components/header-actions';
import { icons } from '@/components/icons';
import { useNow } from '@/features/home/use-now';
import RestaurantMap from '@/features/food/restaurant-map';
import { MAP_AVAILABLE } from '@/features/food/map-availability';
import { useRestaurants } from '@/features/food/use-restaurants';
import type { Restaurant } from '@/features/food/opening-hours';
import { usePalette } from '@/theme/palette';

const CLOCK_INTERVAL_MS = 30_000;

export default function FoodMapScreen() {
  const palette = usePalette();
  const now = useNow(CLOCK_INTERVAL_MS);
  const restaurants = useRestaurants();
  const [selected, setSelected] = useState<Restaurant | null>(null);

  useFocusEffect(useCallback(() => setSelected(null), []));

  const close = () => router.back();
  const openDetail = (restaurant: Restaurant) => {
    setSelected(restaurant);
    router.push({ pathname: '/restaurant', params: { name: restaurant.name } });
  };

  if (!MAP_AVAILABLE) return null;

  const header: HeaderActionsProps = process.env.EXPO_OS === 'android'
    ? { left: [{ kind: 'icon', key: 'close', label: '關閉', icon: icons.close, onPress: close }] }
    : { right: [{ kind: 'text', key: 'done', label: '完成', prominent: true, onPress: close }] };

  return (
    <>
      <Stack.Screen options={{ title: '美食地圖' }} />
      <HeaderActions {...header} />
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        {restaurants.data ? (
          <RestaurantMap
            restaurants={restaurants.data}
            selected={selected}
            now={now}
            onSelect={openDetail}
          />
        ) : restaurants.isError ? (
          <View style={styles.error}>
            <Text style={[styles.errorTitle, { color: palette.text }]}>無法讀取餐廳資料</Text>
            <Text style={[styles.errorMessage, { color: palette.textSecondary }]}>請檢查網路後再試一次。</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="重新讀取餐廳資料"
              onPress={() => void restaurants.refetch()}
              style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={{ color: palette.tint }}>重新讀取</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator
            accessibilityLabel="正在讀取美食地圖"
            color={palette.tint as string}
            size="large"
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  error: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 15,
    marginTop: 8,
  },
  retry: {
    marginTop: 16,
    padding: 12,
  },
});
