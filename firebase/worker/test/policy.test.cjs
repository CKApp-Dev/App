const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldPublish, retryDelay, ticketDisposition, pushBody } = require('../lib/policy');

test('only scheduled announcements at or before server time can publish', () => {
  assert.equal(shouldPublish('scheduled', 1000, 1000), true);
  assert.equal(shouldPublish('scheduled', 999, 1000), true);
  assert.equal(shouldPublish('scheduled', 1001, 1000), false);
  for (const state of ['draft', 'published', 'archived', undefined]) assert.equal(shouldPublish(state, 0, 1000), false);
  assert.equal(shouldPublish('scheduled', NaN, 1000), false);
});

test('transient rate errors retry with capped backoff; invalid tokens are removed', () => {
  assert.equal(ticketDisposition('DeviceNotRegistered'), 'remove');
  assert.equal(ticketDisposition('MessageRateExceeded'), 'retry');
  assert.equal(ticketDisposition('InvalidCredentials'), 'failed');
  assert.equal(ticketDisposition(undefined), 'failed');
  assert.equal(retryDelay(1), 60000);
  assert.equal(retryDelay(3), 240000);
  assert.equal(retryDelay(99), 3600000);
});

test('large multilingual bodies stay within push payload budget without splitting characters', () => {
  const body = pushBody('😀'.repeat(500));
  assert.equal(Array.from(body).length, 240);
  assert.ok(body.endsWith('…'));
  assert.ok(Buffer.byteLength(body) < 1000);
  assert.equal(pushBody('Hello'), 'Hello');
});
