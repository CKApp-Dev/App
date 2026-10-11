import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

import { restorePushPreferences, type DeviceRegistration, type PushPreferences, type PushStatus } from './types';

export interface PushState extends PushPreferences {
  status: PushStatus;
  error: string | null;
  setOptedIn: (enabled: boolean) => void;
  rememberRegistration: (registration: DeviceRegistration) => void;
  queueDisable: (registration: DeviceRegistration) => void;
  finishDisable: (registration: DeviceRegistration) => void;
  setStatus: (status: PushStatus, error?: string | null) => void;
}

const queue = (entries: DeviceRegistration[], registration: DeviceRegistration) => [
  ...entries.filter((entry) => entry.uid !== registration.uid), registration,
];

export const usePushStore = create<PushState>()(
  persist(
    (set) => ({
      optedIn: false,
      registration: null,
      pendingDisable: [],
      status: 'disabled',
      error: null,
      setOptedIn: (optedIn) => set((state) => ({
        optedIn,
        // Persist the obligation before any network call. Keep the token/UID
        // after disabling so a force quit or offline launch can retry it.
        pendingDisable: !optedIn && state.registration
          ? queue(state.pendingDisable, state.registration)
          : state.pendingDisable,
      })),
      rememberRegistration: (registration) => set((state) => ({
        registration,
        pendingDisable: (state.registration && state.registration.uid !== registration.uid
          ? queue(state.pendingDisable, state.registration)
          : state.pendingDisable).filter((entry) => entry.uid !== registration.uid),
      })),
      queueDisable: (registration) => set((state) => ({ pendingDisable: queue(state.pendingDisable, registration) })),
      finishDisable: (registration) => set((state) => ({
        pendingDisable: state.pendingDisable.filter((entry) => entry.uid !== registration.uid || entry.expoPushToken !== registration.expoPushToken),
      })),
      setStatus: (status, error = null) => set({ status, error }),
    }),
    {
      name: 'ck.announcement-push',
      storage: persistStorage,
      version: 1,
      partialize: ({ optedIn, registration, pendingDisable }) => ({ optedIn, registration, pendingDisable }),
      merge: (saved, current) => ({ ...current, ...restorePushPreferences(saved) }),
    },
  ),
);
