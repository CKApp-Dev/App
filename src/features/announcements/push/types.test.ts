import { describe, expect, test } from '@jest/globals';

import { announcementIdFromData, restorePushPreferences } from './types';

describe('notification destination', () => {
  test('accepts only a bounded announcement document ID', () => {
    expect(announcementIdFromData({ announcementId: 'school_2026-10' })).toBe('school_2026-10');
    for (const id of ['', '..', '/settings', 'https://example.com', 'a/b', 'a?admin=true', 'a\n', 'x'.repeat(129), 123, null]) {
      expect(announcementIdFromData({ announcementId: id })).toBeNull();
    }
  });

  test('ignores missing data and arbitrary URL fields', () => {
    for (const data of [null, undefined, [], 'announcement', { url: 'https://example.com' }]) {
      expect(announcementIdFromData(data)).toBeNull();
    }
  });
});

describe('restoring push preferences', () => {
  test('a malformed preference cannot silently opt the device in', () => {
    expect(restorePushPreferences({ optedIn: 'true', registration: { uid: '../admin' }, pendingDisable: [null] })).toEqual({
      optedIn: false, registration: null, pendingDisable: [],
    });
  });

  test('preserves an offline disable without restoring consent', () => {
    const registration = { uid: 'device_123', expoPushToken: 'ExpoPushToken[test-token]', platform: 'ios' };
    expect(restorePushPreferences({ optedIn: false, registration, pendingDisable: [registration, registration] })).toEqual({
      optedIn: false, registration, pendingDisable: [registration],
    });
  });

  test('an acknowledged disable does not become pending again on every launch', () => {
    const registration = { uid: 'device_123', expoPushToken: 'ExponentPushToken[test-token]', platform: 'android' };
    expect(restorePushPreferences({ optedIn: false, registration, pendingDisable: [] }).pendingDisable).toEqual([]);
  });
});
