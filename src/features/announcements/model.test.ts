import { describe, expect, test } from '@jest/globals';

import { announcementUrl, parseAnnouncement, validAnnouncementId } from './model';

const timestamp = (value: number) => ({ toMillis: () => value });
const valid = { status: 'published', title: '新公告', body: '內容', url: 'https://ckapp.tw/', publishAt: timestamp(1000), publishedAt: timestamp(1001) };

describe('published announcements', () => {
  test('accepts valid published content', () => {
    expect(parseAnnouncement('abc_123', valid)).toEqual({ id: 'abc_123', title: '新公告', body: '內容', url: 'https://ckapp.tw/', publishAt: 1000, publishedAt: 1001 });
  });
  test.each(['draft', 'scheduled', 'archived'])('excludes %s content', (status) => {
    expect(parseAnnouncement('abc', { ...valid, status })).toBeNull();
  });
  test('rejects records published before their date and missing timestamps', () => {
    expect(parseAnnouncement('abc', { ...valid, publishedAt: timestamp(999) })).toBeNull();
    expect(parseAnnouncement('abc', { ...valid, publishedAt: null })).toBeNull();
    expect(parseAnnouncement('abc', { ...valid, publishAt: timestamp(NaN) })).toBeNull();
  });
  test('rejects malformed content and timestamp implementations', () => {
    expect(parseAnnouncement('abc', { ...valid, title: ' ' })).toBeNull();
    expect(parseAnnouncement('abc', { ...valid, body: 'a'.repeat(10001) })).toBeNull();
    expect(parseAnnouncement('abc', { ...valid, publishAt: { toMillis() { throw new Error('broken'); } } })).toBeNull();
  });
});

test('links must be HTTPS without embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', '//example.com']) expect(announcementUrl(url)).toBe('');
  expect(announcementUrl('https://example.com/info')).toBe('https://example.com/info');
});

test('notification IDs cannot inject navigation paths', () => {
  for (const id of ['../settings', 'abc/def', '', null, 'a'.repeat(129)]) expect(validAnnouncementId(id)).toBe(false);
  expect(validAnnouncementId('abc-123_XYZ')).toBe(true);
});
