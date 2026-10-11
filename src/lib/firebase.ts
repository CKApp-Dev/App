import Constants from 'expo-constants';
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth, signInAnonymously, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// Installs the same SQLite-backed localStorage the other app stores use.
import '@/lib/storage';

type FirebaseClient = { app: FirebaseApp; db: Firestore };
let client: FirebaseClient | null | undefined;
let deviceAuth: Promise<Auth> | undefined;
let initializedAuth: Auth | undefined;

export function getFirebaseClient(): FirebaseClient | null {
  if (client !== undefined) return client;
  const config = Constants.expoConfig?.extra?.firebase as FirebaseOptions | undefined;
  if (!config?.apiKey || !config.projectId || !config.appId) return (client = null);
  const app = getApps().length ? getApp() : initializeApp(config);
  client = { app, db: getFirestore(app) };
  return client;
}

const deviceStorage = {
  async getItem(key: string) { return localStorage.getItem(key); },
  async setItem(key: string, value: string) { localStorage.setItem(key, value); },
  async removeItem(key: string) { localStorage.removeItem(key); },
};

function nativePersistence(): Persistence {
  // Firebase's web declaration file omits this documented native export;
  // Metro resolves firebase/auth to its React Native implementation.
  const createPersistence = Reflect.get(FirebaseAuth, 'getReactNativePersistence') as
    ((storage: typeof deviceStorage) => Persistence) | undefined;
  if (!createPersistence) throw new Error('Firebase native authentication is unavailable.');
  return createPersistence(deviceStorage);
}

/** Stable anonymous identity is used only for this device's push subscription. */
export function getDeviceAuth(): Promise<Auth> {
  if (deviceAuth) return deviceAuth;
  deviceAuth = (async () => {
    const firebase = getFirebaseClient();
    if (!firebase) throw new Error('Firebase is not configured.');
    // Browser Firebase handles its own cross-tab persistence. Native Auth
    // uses the existing SQLite store and needs no additional native SDK.
    // Keep the initialized instance even if the sign-in request fails offline.
    // Reinitializing with a new persistence constructor would reject retries.
    const auth = initializedAuth ??= Platform.OS === 'web'
      ? getAuth(firebase.app)
      : initializeAuth(firebase.app, { persistence: nativePersistence() });
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth;
  })().catch((error: unknown) => { deviceAuth = undefined; throw error; });
  return deviceAuth;
}
