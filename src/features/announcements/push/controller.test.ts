import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createPushController, type PushDependencies } from './controller';
import { usePushStore } from './store';
import type { DeviceRegistration, NativePushToken } from './types';

const mockMemory = new Map<string, string>();

jest.mock('@/lib/storage', () => {
  const { createJSONStorage } = jest.requireActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    persistStorage: createJSONStorage(() => ({
      getItem: (key: string) => mockMemory.get(key) ?? null,
      setItem: (key: string, value: string) => { mockMemory.set(key, value); },
      removeItem: (key: string) => { mockMemory.delete(key); },
    })),
  };
});

const registration: DeviceRegistration = { uid: 'device_123', expoPushToken: 'ExpoPushToken[old-token]', platform: 'ios' };

function setup(overrides: Partial<PushDependencies> = {}) {
  const getPermission = jest.fn(async () => true);
  const requestPermission = jest.fn(async () => true);
  const getIdentity = jest.fn(async () => ({ uid: registration.uid, platform: registration.platform }));
  const getToken = jest.fn(async (_nativeToken?: NativePushToken) => 'ExpoPushToken[new-token]');
  const write = jest.fn(async (_registration: DeviceRegistration, _enabled: boolean) => {});
  const controller = createPushController({
    getState: usePushStore.getState,
    availability: () => null,
    getPermission, requestPermission, getIdentity, getToken, write,
    ...overrides,
  });
  return { controller, getPermission, requestPermission, getIdentity, getToken, write };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  mockMemory.clear();
  usePushStore.setState({ optedIn: false, registration: null, pendingDisable: [], status: 'disabled', error: null });
});

describe('push consent and retry', () => {
  test('a new install neither reads nor requests permission on startup', async () => {
    const { controller, getPermission, requestPermission, write } = setup();
    await controller.reconcile();
    expect(getPermission).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(usePushStore.getState().status).toBe('disabled');
  });

  test('startup never prompts an opted-in device after OS permission was revoked', async () => {
    usePushStore.setState({ optedIn: true, registration });
    const { controller, requestPermission, write } = setup({ getPermission: async () => false });
    await controller.reconcile();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(registration, false);
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, status: 'denied', pendingDisable: [] });
  });

  test('only an explicit enable requests permission and registers the device', async () => {
    const { controller, requestPermission, write } = setup({ getPermission: async () => false });
    await controller.enable();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ ...registration, expoPushToken: 'ExpoPushToken[new-token]' }, true);
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, status: 'enabled' });
  });

  test('an unconfigured app cannot request permission or persist opt-in', async () => {
    const { controller, requestPermission } = setup({ availability: () => 'unconfigured' });
    await controller.enable();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(usePushStore.getState()).toMatchObject({ optedIn: false, status: 'unconfigured' });
  });

  test('an offline disable survives store rehydration and retries next launch', async () => {
    usePushStore.setState({ optedIn: true, registration });
    const { controller, write } = setup();
    write.mockRejectedValueOnce(new Error('offline'));
    await controller.disable();
    expect(usePushStore.getState()).toMatchObject({ optedIn: false, registration, pendingDisable: [registration], status: 'disabled' });
    const persisted = JSON.parse(mockMemory.get('ck.announcement-push')!);
    expect(persisted.state).toMatchObject({ optedIn: false, pendingDisable: [registration] });
    await usePushStore.persist.rehydrate();
    await controller.reconcile();
    expect(write).toHaveBeenLastCalledWith(registration, false);
    expect(usePushStore.getState()).toMatchObject({ optedIn: false, registration, pendingDisable: [] });
  });

  test('a late token operation cannot re-enable a device after Disable', async () => {
    const identity = deferred<Pick<DeviceRegistration, 'uid' | 'platform'>>();
    const reachedIdentity = deferred<void>();
    const { controller, getToken, write } = setup({ getIdentity: async () => { reachedIdentity.resolve(); return identity.promise; } });
    const enabling = controller.enable();
    await reachedIdentity.promise;
    await controller.disable();
    identity.resolve({ uid: registration.uid, platform: registration.platform });
    await enabling;
    expect(getToken).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(usePushStore.getState()).toMatchObject({ optedIn: false, status: 'disabled' });
  });

  test('Disable revokes an enable awaiting server acknowledgement', async () => {
    const acknowledgement = deferred<void>();
    const submitted = deferred<void>();
    const writes: boolean[] = [];
    const { controller } = setup({ write: async (_entry, enabled) => {
      writes.push(enabled);
      if (enabled) { submitted.resolve(); await acknowledgement.promise; }
    } });
    const enabling = controller.enable();
    await submitted.promise;
    await controller.disable();
    expect(writes).toEqual([true, false]);
    acknowledgement.resolve();
    await enabling;
    expect(usePushStore.getState()).toMatchObject({ optedIn: false, status: 'disabled', pendingDisable: [] });
  });

  test('a token rotation passes the supplied native token without fetching it again', async () => {
    usePushStore.setState({ optedIn: true, registration });
    const { controller, getToken, write } = setup();
    const token: NativePushToken = { type: 'ios', data: 'rotated-device-token' };
    await controller.refreshToken(token);
    expect(getToken).toHaveBeenCalledWith(token);
    expect(write).toHaveBeenCalledWith({ ...registration, expoPushToken: 'ExpoPushToken[new-token]' }, true);
  });
});
