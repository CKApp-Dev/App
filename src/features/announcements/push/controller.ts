import type { PushState } from './store';
import type { DeviceRegistration, NativePushToken, PushStatus } from './types';

export interface PushDependencies {
  getState: () => PushState;
  availability: () => 'unsupported' | 'unconfigured' | null;
  getPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  getIdentity: () => Promise<Pick<DeviceRegistration, 'uid' | 'platform'>>;
  getToken: (nativeToken?: NativePushToken) => Promise<string>;
  write: (registration: DeviceRegistration, enabled: boolean) => Promise<void>;
}

/** Kept separate from native APIs so permission and offline races can be tested. */
export function createPushController(deps: PushDependencies) {
  let revision = 0;

  async function flushDisables() {
    const pending = deps.getState().pendingDisable;
    let failed = false;
    for (const entry of pending) {
      // An enable may have superseded this request while another write awaited.
      if (!deps.getState().pendingDisable.some((current) => current.uid === entry.uid && current.expoPushToken === entry.expoPushToken)) continue;
      try {
        await deps.write(entry, false);
        deps.getState().finishDisable(entry);
      } catch {
        failed = true;
      }
    }
    return !failed;
  }

  async function reconcile(requestPermission = false, nativeToken?: NativePushToken) {
    const currentRevision = ++revision;
    const current = () => revision === currentRevision;
    const setStatus = (status: PushStatus, error: string | null = null) => {
      if (current()) deps.getState().setStatus(status, error);
    };
    const unavailable = deps.availability();
    if (!deps.getState().optedIn || unavailable) {
      setStatus(unavailable ?? 'disabled');
      const synced = await flushDisables();
      if (!synced) setStatus(unavailable ?? 'disabled', '通知已關閉，連線恢復後會再次同步。');
      return;
    }

    setStatus('busy');
    try {
      let allowed = await deps.getPermission();
      if (!current() || !deps.getState().optedIn) return;
      // Only the explicit Enable action can ever request OS permission.
      if (!allowed && requestPermission) allowed = await deps.requestPermission();
      if (!current() || !deps.getState().optedIn) return;
      if (!allowed) {
        const previous = deps.getState().registration;
        if (previous) deps.getState().queueDisable(previous);
        setStatus('denied');
        const synced = await flushDisables();
        if (!synced) setStatus('denied', '系統已關閉通知，連線恢復後會再次同步。');
        return;
      }

      // Submit pending disables before a fresh enable so Firestore preserves
      // the user's final intent even if the connection drops during the writes.
      await flushDisables();
      if (!current() || !deps.getState().optedIn) return;
      const identity = await deps.getIdentity();
      if (!current() || !deps.getState().optedIn) return;
      const expoPushToken = await deps.getToken(nativeToken);
      if (!current() || !deps.getState().optedIn) return;
      const registration = { ...identity, expoPushToken };
      // Save first: Disable can now revoke this exact device even while the
      // enable write is waiting for an offline Firestore acknowledgement.
      deps.getState().rememberRegistration(registration);
      await deps.write(registration, true);
      setStatus('enabled');
    } catch {
      setStatus('error', '無法同步通知設定，請檢查網路連線後再試一次。');
    }
  }

  return {
    reconcile: () => reconcile(),
    refreshToken: (token: NativePushToken) => reconcile(false, token),
    enable: async () => {
      if (deps.availability()) {
        deps.getState().setStatus(deps.availability()!);
        return;
      }
      deps.getState().setOptedIn(true);
      await reconcile(true);
    },
    disable: async () => {
      ++revision;
      deps.getState().setOptedIn(false);
      await reconcile();
    },
  };
}
