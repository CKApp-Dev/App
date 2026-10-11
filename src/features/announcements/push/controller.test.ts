import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createPushController, type PushDependencies } from './controller';
import { usePushStore } from './store';
import { initialPushPreferences, type DeviceRegistration, type NativePushToken } from './types';

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
  usePushStore.setState({ optedIn: false, automaticPermissionHandled: true, registration: null, pendingDisable: [], status: 'disabled', error: null });
});

describe('push preferences and retry', () => {
  test('a fresh install automatically requests permission and registers on first entry', async () => {
    mockMemory.clear();
    await usePushStore.persist.rehydrate();
    expect(usePushStore.getState()).toMatchObject({ ...initialPushPreferences() });
    const { controller, requestPermission, write } = setup({ getPermission: async () => false });
    await controller.start();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ ...registration, expoPushToken: 'ExpoPushToken[new-token]' }, true);
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, automaticPermissionHandled: true, status: 'enabled' });
  });

  test('a saved opt-out neither reads nor requests permission on startup', async () => {
    mockMemory.set('ck.announcement-push', JSON.stringify({
      state: { optedIn: false, registration: null, pendingDisable: [] }, version: 1,
    }));
    await usePushStore.persist.rehydrate();
    const { controller, getPermission, requestPermission, write } = setup();
    await controller.start();
    expect(getPermission).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(usePushStore.getState().status).toBe('disabled');
  });

  test('startup never prompts an opted-in device after OS permission was revoked', async () => {
    usePushStore.setState({ optedIn: true, registration });
    const { controller, requestPermission, write } = setup({ getPermission: async () => false });
    await controller.start();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(registration, false);
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, status: 'denied', pendingDisable: [] });
  });

  test('an explicit enable can request permission and register after an opt-out', async () => {
    const { controller, requestPermission, write } = setup({ getPermission: async () => false });
    await controller.enable();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ ...registration, expoPushToken: 'ExpoPushToken[new-token]' }, true);
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, status: 'enabled' });
  });

  test('a denied automatic permission request is not repeated after a restart', async () => {
    usePushStore.setState(initialPushPreferences());
    const requestPermission = jest.fn(async () => false);
    const { controller, write } = setup({ getPermission: async () => false, requestPermission });
    await controller.start();
    await usePushStore.persist.rehydrate();
    await controller.start();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, automaticPermissionHandled: true, status: 'denied' });
  });

  test('already granted first-entry permission cannot prompt later after OS revocation', async () => {
    usePushStore.setState(initialPushPreferences());
    const permission = jest.fn(async () => true);
    const { controller, requestPermission, write } = setup({ getPermission: permission });
    await controller.start();
    permission.mockResolvedValue(false);
    await controller.start();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(write).toHaveBeenLastCalledWith({ ...registration, expoPushToken: 'ExpoPushToken[new-token]' }, false);
    expect(usePushStore.getState()).toMatchObject({ automaticPermissionHandled: true, status: 'denied' });
  });

  test('an unavailable first launch preserves automatic setup for a configured launch', async () => {
    usePushStore.setState(initialPushPreferences());
    const { controller, getPermission, requestPermission } = setup({ availability: () => 'unconfigured' });
    await controller.start();
    expect(getPermission).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, automaticPermissionHandled: false, status: 'unconfigured' });
  });

  test('returning to the app during the first permission dialog shares that request', async () => {
    usePushStore.setState(initialPushPreferences());
    const permission = deferred<boolean>();
    const prompting = deferred<void>();
    const requestPermission = jest.fn(async () => { prompting.resolve(); return permission.promise; });
    const { controller, write } = setup({ getPermission: async () => false, requestPermission });
    const launching = controller.start();
    await prompting.promise;
    const foregrounding = controller.start();
    permission.resolve(true);
    await Promise.all([launching, foregrounding]);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(usePushStore.getState()).toMatchObject({ optedIn: true, automaticPermissionHandled: true, status: 'enabled' });
  });

  test('an early token rotation cannot cancel the first permission check', async () => {
    usePushStore.setState(initialPushPreferences());
    const permission = deferred<boolean>();
    const getPermission = jest.fn(() => permission.promise);
    const { controller, requestPermission, getToken, write } = setup({ getPermission });
    const launching = controller.start();
    await controller.refreshToken({ type: 'ios', data: 'rotated-device-token' });
    expect(getPermission).toHaveBeenCalledTimes(1);
    permission.resolve(false);
    await launching;
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith(undefined);
    expect(write).toHaveBeenCalledTimes(1);
    expect(usePushStore.getState()).toMatchObject({ automaticPermissionHandled: true, status: 'enabled' });
  });

  test('disabling during the automatic permission dialog prevents registration', async () => {
    usePushStore.setState(initialPushPreferences());
    const permission = deferred<boolean>();
    const prompting = deferred<void>();
    const { controller, getToken, write } = setup({ getPermission: async () => false,
      requestPermission: async () => { prompting.resolve(); return permission.promise; } });
    const launching = controller.start();
    await prompting.promise;
    await controller.disable();
    permission.resolve(true);
    await launching;
    expect(getToken).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(usePushStore.getState()).toMatchObject({ optedIn: false, automaticPermissionHandled: true, status: 'disabled' });
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
