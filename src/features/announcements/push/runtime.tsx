import * as Notifications from 'expo-notifications';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { pushAvailability, pushController } from './registration';
import { usePushStore } from './store';
import { announcementIdFromData, type NativePushToken } from './types';

const handledResponses = new Set<string>();

// This runs before the first render so an early foreground notification also
// uses the app's preference. No Firestore listener generates local alerts.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = usePushStore.getState().optedIn && announcementIdFromData(notification.request.content.data) !== null;
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

export function NotificationRuntime() {
  const router = useRouter();
  const navigation = useRootNavigationState();
  const pathname = usePathname();
  const [pendingResponse, setPendingResponse] = useState<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    if (pushAvailability() === 'unsupported') return;
    const response = Notifications.addNotificationResponseReceivedListener((value) => setPendingResponse(value));
    const rotation = Notifications.addPushTokenListener((token) => {
      if ((token.type === 'ios' || token.type === 'android') && typeof token.data === 'string') {
        void pushController.refreshToken(token as NativePushToken);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pushController.start();
    });
    // Request the new-install permission once the app is visible. Background
    // launches wait for the next active event before showing the OS dialog.
    if (AppState.currentState === 'active') void pushController.start();
    // A response listener alone misses taps that launch a terminated app.
    void Notifications.getLastNotificationResponseAsync().then((value) => {
      if (mounted && value) setPendingResponse((current) => current ?? value);
    }).catch(() => {});
    return () => {
      mounted = false;
      response.remove();
      rotation.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    // The index route redirects to Home/onboarding. Wait for that redirect so
    // it cannot replace a notification destination during a cold launch.
    if (!navigation?.key || pathname === '/' || !pendingResponse) return;
    const id = announcementIdFromData(pendingResponse.notification.request.content.data);
    const key = `${pendingResponse.notification.request.identifier}:${pendingResponse.actionIdentifier}`;
    if (!id || pendingResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER || handledResponses.has(key)) return;
    // A single cold-launch tap may be delivered by both native APIs.
    handledResponses.add(key);
    if (handledResponses.size > 100) handledResponses.delete(handledResponses.values().next().value!);
    router.push({ pathname: '/announcements/[id]', params: { id } });
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [navigation?.key, pathname, pendingResponse, router]);

  return null;
}
