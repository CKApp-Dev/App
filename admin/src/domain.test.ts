import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyEditor, parseTaipeiInput, toTaipeiInput, validateEditor } from './domain.ts';

const now = new Date('2026-10-11T01:00:00.000Z');
const valid = { title: '  校園公告  ', body: '  下週一開始報名。  ', url: ' https://example.com/event ', publishTime: '2026-10-11T10:30' };

test('Taipei schedule is interpreted as UTC+8 regardless of the browser time zone', () => {
  assert.equal(parseTaipeiInput(valid.publishTime)?.toISOString(), '2026-10-11T02:30:00.000Z');
  assert.equal(toTaipeiInput(now), '2026-10-11T09:00');
  assert.equal(toTaipeiInput(new Date('2026-10-10T16:00:00.000Z')), '2026-10-11T00:00');
});

test('invalid calendar dates and malformed values cannot become a schedule', () => {
  for (const value of ['2026-02-30T10:00', '2026-10-11T24:00', '2026-13-11T10:00', '', '2026-10-11T10:00Z']) {
    assert.equal(parseTaipeiInput(value), null, value);
  }
});

test('scheduled publications require a future date and trim saved text', () => {
  const result = validateEditor(valid, 'schedule', now);
  assert.deepEqual(result.errors, {});
  assert.equal(result.data.status, 'scheduled');
  assert.equal(result.data.title, '校園公告');
  assert.equal(result.data.url, 'https://example.com/event');
  assert.equal(result.data.publishAt.toISOString(), '2026-10-11T02:30:00.000Z');
  assert.ok(validateEditor({ ...valid, publishTime: '2026-10-11T09:00' }, 'schedule', now).errors.publishTime);
  assert.ok(validateEditor({ ...valid, publishTime: '2026-10-11T08:59' }, 'schedule', now).errors.publishTime);
});

test('publish now queues a server publication, drafts stay unpublished', () => {
  const immediate = validateEditor(valid, 'now', now);
  assert.equal(immediate.data.status, 'scheduled');
  assert.equal(immediate.data.publishAt, now);
  const draft = validateEditor({ ...valid, publishTime: '' }, 'draft', now);
  assert.deepEqual(draft.errors, {});
  assert.equal(draft.data.status, 'draft');
  assert.equal(draft.data.publishAt, now);
});

test('empty content, oversized fields and unsafe links are rejected', () => {
  assert.ok(validateEditor(emptyEditor(now), 'draft', now).errors.title);
  assert.ok(validateEditor({ ...valid, title: 'a'.repeat(121) }, 'draft', now).errors.title);
  assert.ok(validateEditor({ ...valid, body: 'a'.repeat(10_001) }, 'draft', now).errors.body);
  for (const url of ['http://example.com', 'javascript:alert(1)', '/relative', 'https://user:pass@example.com']) {
    assert.ok(validateEditor({ ...valid, url }, 'draft', now).errors.url, url);
  }
  assert.ok(validateEditor({ ...valid, url: `https://example.com/${'a'.repeat(2048)}` }, 'draft', now).errors.url);
  assert.deepEqual(validateEditor({ ...valid, url: '' }, 'draft', now).errors, {});
});
