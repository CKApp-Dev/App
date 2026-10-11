import { expect, jest, test } from '@jest/globals';

const mockAuth = { authStateReady: jest.fn(async () => {}), currentUser: null as null | { uid: string } };
const mockInitialize = jest.fn(() => mockAuth);
const mockSignIn = jest.fn(async () => { mockAuth.currentUser = { uid: 'same-device' }; });
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { firebase: { apiKey: 'test', projectId: 'test', appId: 'test' } } } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/lib/storage', () => ({}));
jest.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({ name: 'test' }) }));
jest.mock('firebase/firestore', () => ({ getFirestore: () => ({}) }));
jest.mock('firebase/auth', () => ({
  initializeAuth: mockInitialize,
  signInAnonymously: mockSignIn,
  getReactNativePersistence: () => class NativePersistence {},
}));

test('an offline anonymous sign-in retries with the same initialized Auth instance', async () => {
  mockSignIn.mockRejectedValueOnce(new Error('offline'));
  const { getDeviceAuth } = jest.requireActual<typeof import('./firebase')>('./firebase');
  await expect(getDeviceAuth()).rejects.toThrow('offline');
  const auth = await getDeviceAuth();
  expect(auth.currentUser?.uid).toBe('same-device');
  expect(mockInitialize).toHaveBeenCalledTimes(1);
  expect(await getDeviceAuth()).toBe(auth);
  expect(mockSignIn).toHaveBeenCalledTimes(2);
});
