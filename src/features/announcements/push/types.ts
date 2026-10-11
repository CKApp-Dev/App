export type PushStatus = 'unsupported' | 'unconfigured' | 'disabled' | 'denied' | 'enabled' | 'busy' | 'error';

export interface DeviceRegistration {
  uid: string;
  expoPushToken: string;
  platform: 'ios' | 'android';
}

export interface PushPreferences {
  optedIn: boolean;
  registration: DeviceRegistration | null;
  pendingDisable: DeviceRegistration[];
}

export interface NativePushToken {
  type: 'ios' | 'android';
  data: string;
}

/** Notification data is untrusted. Only a document ID may become a route parameter. */
export function announcementIdFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).announcementId;
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

function validRegistration(value: unknown): value is DeviceRegistration {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(entry.uid)
    && typeof entry.expoPushToken === 'string' && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(entry.expoPushToken)
    && (entry.platform === 'ios' || entry.platform === 'android');
}

/** Invalid persisted data must never turn notifications on or become a Firestore path. */
export function restorePushPreferences(value: unknown): PushPreferences {
  const saved = value && typeof value === 'object' ? value as Partial<PushPreferences> : {};
  const registration = validRegistration(saved.registration) ? saved.registration : null;
  const pendingDisable = Array.isArray(saved.pendingDisable)
    ? saved.pendingDisable.filter(validRegistration).filter((entry, index, all) => all.findIndex((other) => other.uid === entry.uid) === index)
    : [];
  const optedIn = saved.optedIn === true;
  return { optedIn, registration, pendingDisable };
}
