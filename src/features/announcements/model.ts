export interface Announcement {
  id: string;
  title: string;
  body: string;
  url: string;
  publishAt: number;
  publishedAt: number;
}

function timestampMillis(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('toMillis' in value) || typeof value.toMillis !== 'function') return null;
  try {
    const millis: unknown = value.toMillis();
    return typeof millis === 'number' && Number.isFinite(millis) && !Number.isNaN(new Date(millis).getTime()) ? millis : null;
  } catch { return null; }
}

export function validAnnouncementId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function announcementUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

/** Malformed records, drafts and scheduled entries never reach the UI. */
export function parseAnnouncement(id: string, data: unknown): Announcement | null {
  if (!validAnnouncementId(id) || !data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.status !== 'published') return null;
  if (typeof record.title !== 'string' || !record.title.trim() || record.title.length > 120) return null;
  if (typeof record.body !== 'string' || !record.body.trim() || record.body.length > 10000) return null;
  const publishAt = timestampMillis(record.publishAt);
  const publishedAt = timestampMillis(record.publishedAt);
  if (publishAt === null || publishedAt === null || publishedAt < publishAt) return null;
  return { id, title: record.title.trim(), body: record.body.trim(), url: announcementUrl(record.url), publishAt, publishedAt };
}

export function formatAnnouncementDate(millis: number): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(millis));
}
