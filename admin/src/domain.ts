export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type SaveAction = 'draft' | 'schedule' | 'now';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  url: string;
  status: AnnouncementStatus;
  publishAt: Date;
  publishedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
}

export interface EditorValues {
  title: string;
  body: string;
  url: string;
  publishTime: string;
}

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: '草稿', scheduled: '已排程', published: '已發布', archived: '已封存',
};

const taipeiDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const displayDate = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function toTaipeiInput(date: Date): string {
  return taipeiDate.format(date).replace(' ', 'T');
}

export function parseTaipeiInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(parsed.getTime()) || toTaipeiInput(parsed) !== value) return null;
  return parsed;
}

export function formatDate(date: Date | null): string {
  return date ? displayDate.format(date) : '等待伺服器確認';
}

export function emptyEditor(now = new Date()): EditorValues {
  return { title: '', body: '', url: '', publishTime: toTaipeiInput(new Date(now.getTime() + 60 * 60_000)) };
}

export function editorFor(announcement: Announcement): EditorValues {
  return {
    title: announcement.title, body: announcement.body, url: announcement.url,
    publishTime: toTaipeiInput(announcement.publishAt),
  };
}

export function validateEditor(values: EditorValues, action: SaveAction, now = new Date()) {
  const errors: Partial<Record<keyof EditorValues, string>> = {};
  const title = values.title.trim();
  const body = values.body.trim();
  const url = values.url.trim();
  if (!title) errors.title = '請輸入公告標題。';
  else if (title.length > 120) errors.title = '標題不可超過 120 個字元。';
  if (!body) errors.body = '請輸入公告內容。';
  else if (body.length > 10_000) errors.body = '內容不可超過 10,000 個字元。';
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) throw new Error();
    } catch { errors.url = '請使用完整的 HTTPS 網址，例如 https://example.com。'; }
    if (url.length > 2048) errors.url = '網址不可超過 2,048 個字元。';
  }
  let publishAt = action === 'now' ? now : parseTaipeiInput(values.publishTime);
  if (action === 'schedule' && (!publishAt || publishAt.getTime() <= now.getTime())) {
    errors.publishTime = '請選擇未來的發布時間（台北時間）。';
  }
  if (action === 'draft' && !publishAt) publishAt = now;
  return { errors, data: { title, body, url, publishAt: publishAt ?? now, status: action === 'draft' ? 'draft' : 'scheduled' } as const };
}
