import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { LegacyImporter } from '@/features/legacy-import/legacy-importer';
import { NotificationRuntime } from '@/features/announcements/push';
import { isAttemptingLegacyImport, startLegacyImport } from '@/features/legacy-import/session';
import { queryClient } from '@/lib/query-client';
import { useStackScreenOptions } from '@/navigation/stack-options';
import { useInitializeNowWidget } from '@/widgets/use-now-widget';

void SplashScreen.preventAutoHideAsync();

// Decided once per launch, before the first render.
startLegacyImport();

// The root can mount again in a JS runtime that outlived the splash screen
// (Android 11 and earlier finish the activity on back), so this is per runtime.
let splashHidden = false;

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  useInitializeNowWidget();
  const colorScheme = useColorScheme();
  const options = useStackScreenOptions();
  // Read at mount: the attempt may have ended while an earlier mount was up.
  const [reading, setReading] = useState(isAttemptingLegacyImport);
  // While the previous app's data is read, the splash stays up (at most
  // SPLASH_TIMEOUT_MS) with no screen mounted, so neither the user nor the
  // screens' automatic timetable load can write to the stores first.
  const [holding, setHolding] = useState(() => reading && !splashHidden);
  const splashOver = useCallback(() => setHolding(false), []);
  const settled = useCallback(() => { setReading(false); setHolding(false); }, []);
  useEffect(() => {
    if (holding) return;
    splashHidden = true;
    void SplashScreen.hideAsync();
  }, [holding]);
  // The reader comes second so it stays mounted when the app appears.
  return <>
    {holding ? null : <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={options}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* 你是哪一班？ on a new install: full screen, left only by answering or skipping. */}
          <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
          {/* A sheet with its own stack (settings/_layout.tsx), so its header is that stack's. */}
          <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="event-editor" options={{ presentation: 'modal', title: '活動' }} />
          <Stack.Screen name="todo-editor" options={{ presentation: 'modal', title: '待辦事項' }} />
          <Stack.Screen name="schedule-editor" options={{ presentation: 'modal', title: '編輯課程' }} />
          <Stack.Screen name="categories" options={{ presentation: 'modal', title: '類別管理' }} />
          <Stack.Screen name="youbike-picker" options={{ presentation: 'modal', title: '新增 YouBike 站點' }} />
          <Stack.Screen name="metro-picker" options={{ presentation: 'modal', title: '新增捷運車站' }} />
          <Stack.Screen name="youbike-rename" options={{ presentation: 'modal', title: '修改站點暱稱' }} />
          <Stack.Screen name="restaurant" options={{ presentation: 'modal', title: '餐廳資訊' }} />
          <Stack.Screen name="announcements/index" options={{ title: '公告' }} />
          <Stack.Screen name="announcements/[id]" options={{ title: '公告內容' }} />
        </Stack>
        <NotificationRuntime />
      </ThemeProvider>
    </QueryClientProvider>}
    {reading && <LegacyImporter onSplashOver={splashOver} onSettled={settled} />}
  </>;
}
