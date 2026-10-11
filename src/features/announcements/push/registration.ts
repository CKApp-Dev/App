import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { getDeviceAuth, getFirebaseClient } from '@/lib/firebase';

import { createPushController } from './controller';
import { usePushStore } from './store';
import type { NativePushToken } from './types';

export const ANNOUNCEMENT_CHANNEL = 'announcements';
const networkTimeoutMs = 12_000;

function projectId(): string | null {
  const value: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : null;
}

export function pushAvailability(): 'unsupported' | 'unconfigured' | null {
  if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !Device.isDevice || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'unsupported';
  return getFirebaseClient() && projectId() ? null : 'unconfigured';
}

function permissionAllowed(permission: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === 'ios' && permission.ios) {
    return permission.ios.status === Notifications.IosAuthorizationStatus.AUTHORIZED
      || permission.ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      || permission.ios.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
  }
  return permission.granted;
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANNOUNCEMENT_CHANNEL, {
      name: '校園公告',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

/** Firestore promises await server acknowledgement indefinitely while offline. */
function bounded<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Push registration timed out')), networkTimeoutMs);
    promise.then((result) => { clearTimeout(timer); resolve(result); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

export const pushController = createPushController({
  getState: usePushStore.getState,
  availability: pushAvailability,
  getPermission: async () => permissionAllowed(await Notifications.getPermissionsAsync()),
  requestPermission: async () => {
    await ensureChannel();
    const existing = await Notifications.getPermissionsAsync();
    if (!existing.canAskAgain) return permissionAllowed(existing);
    return permissionAllowed(await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    }));
  },
  getIdentity: async () => {
    const auth = await bounded(getDeviceAuth());
    if (!auth.currentUser || (Platform.OS !== 'ios' && Platform.OS !== 'android')) throw new Error('Device identity unavailable');
    return { uid: auth.currentUser.uid, platform: Platform.OS };
  },
  getToken: async (nativeToken?: NativePushToken) => {
    const id = projectId();
    if (!id) throw new Error('Missing EAS project');
    await ensureChannel();
    const token = await bounded(Notifications.getExpoPushTokenAsync({
      projectId: id,
      // The rotation listener already supplies the native token. Fetching it
      // again from inside that listener can recursively trigger the listener.
      ...(nativeToken ? { devicePushToken: nativeToken } : {}),
    }));
    if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token.data)) throw new Error('Invalid Expo push token');
    return token.data;
  },
  write: async (registration, enabled) => {
    const client = getFirebaseClient();
    if (!client) throw new Error('Firebase unavailable');
    const auth = await bounded(getDeviceAuth());
    if (auth.currentUser?.uid !== registration.uid) throw new Error('Device identity changed');
    // Authentication can await the network. A Disable pressed in that interval
    // must prevent an older operation from submitting a late enable write.
    if (enabled && (!usePushStore.getState().optedIn || usePushStore.getState().registration?.expoPushToken !== registration.expoPushToken)) return;
    await bounded(setDoc(doc(client.db, 'devices', registration.uid), {
      expoPushToken: registration.expoPushToken,
      platform: registration.platform,
      enabled,
      updatedAt: serverTimestamp(),
    }, { merge: true }));
  },
});
