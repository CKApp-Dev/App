const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { publishDueAnnouncements } = require('../lib/publisher');
const { dispatchNotifications, checkNotificationReceipts } = require('../lib/delivery');
const { LEASE_MS, RECEIPT_DELAY_MS } = require('../lib/policy');
const projectId = 'demo-ck-announcements';
let app, db;
const now = Timestamp.fromMillis(2000000000000);
const token = 'ExpoPushToken[device-one]';
const at = (offset = 0) => Timestamp.fromMillis(now.toMillis() + offset);
const announcement = (status = 'scheduled', offset = 0) => ({
  title: 'School announcement', body: 'Please check the home page.', url: '', status,
  publishAt: at(offset), publishedAt: null, createdAt: at(-10000), updatedAt: at(-10000), createdBy: 'admin',
});
const device = (expoPushToken = token) => ({ expoPushToken, enabled: true, platform: 'ios', updatedAt: at(-1000) });
const gateway = (send, receipts = async () => ({})) => ({ sendPushNotificationsAsync: send, getPushNotificationReceiptsAsync: receipts });

before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Refusing to run backend integration tests without the Firestore emulator');
  app = initializeApp({ projectId }, 'backend-test');
  db = getFirestore(app);
});
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('overlapping publishers create exactly one immutable job and leave future/draft announcements private', async () => {
  await Promise.all([
    db.doc('announcements/due').set(announcement()),
    db.doc('announcements/future').set(announcement('scheduled', 1)),
    db.doc('announcements/draft').set(announcement('draft', -1000)),
  ]);
  const counts = await Promise.all([publishDueAnnouncements(db, now), publishDueAnnouncements(db, now)]);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 1);
  assert.equal((await db.doc('announcements/due').get()).data().status, 'published');
  assert.equal((await db.doc('announcements/future').get()).data().status, 'scheduled');
  assert.equal((await db.doc('announcements/draft').get()).data().status, 'draft');
  assert.equal((await db.collection('notificationJobs').get()).size, 1);
  assert.equal((await db.doc('notificationJobs/due').get()).data().payload.title, 'School announcement');
  assert.equal(await publishDueAnnouncements(db, at(1)), 1);
});

test('dispatch sends visible OS notifications once, checkpoints progress, and saves receipts', async () => {
  await db.doc('announcements/due').set(announcement());
  await db.doc('devices/a').set(device());
  await db.doc('devices/b').set(device()); // Same Expo token, different installation identity.
  await db.doc('devices/off').set({ ...device('ExpoPushToken[off]'), enabled: false });
  await publishDueAnnouncements(db, now);
  const sent = [];
  const push = gateway(async (messages) => { sent.push(...messages); return messages.map((_, i) => ({ status: 'ok', id: `ticket-${i}` })); });
  await Promise.all([dispatchNotifications(db, push, now), dispatchNotifications(db, push, now)]);
  await dispatchNotifications(db, push, at(60000));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].data, { announcementId: 'due' });
  assert.equal(sent[0].sound, 'default');
  assert.equal(sent[0].channelId, 'announcements');
  const job = (await db.doc('notificationJobs/due').get()).data();
  assert.equal(job.status, 'complete');
  assert.equal(job.acceptedCount, 1);
  assert.equal((await db.doc('notificationReceipts/ticket-0').get()).data().status, 'pending');
});

test('expired leases resume an ambiguous send using durable batches without replaying completed pages', async () => {
  await db.doc('announcements/due').set(announcement());
  await db.doc('devices/a').set(device());
  await publishDueAnnouncements(db, now);
  let attempts = 0;
  const push = gateway(async () => { attempts++; if (attempts === 1) throw new Error('network failure'); return [{ status: 'ok', id: 'ticket-retry' }]; });
  await dispatchNotifications(db, push, now);
  const deferred = (await db.doc('notificationJobs/due').get()).data();
  assert.equal(deferred.activeBatch, '00000000');
  assert.equal(deferred.cursor, '');
  assert.equal((await db.doc('notificationJobs/due/batches/00000000').get()).data().recipients[0].attempts, 1);
  await dispatchNotifications(db, push, at(59000));
  assert.equal(attempts, 1);
  await dispatchNotifications(db, push, at(60000));
  assert.equal(attempts, 2);
  assert.equal((await db.doc('notificationJobs/due').get()).data().status, 'complete');
});

test('rate-limit retries do not resend already accepted tokens in the batch', async () => {
  await db.doc('announcements/due').set(announcement());
  await db.doc('devices/a').set(device());
  await db.doc('devices/b').set(device('ExpoPushToken[second]'));
  await publishDueAnnouncements(db, now);
  const sends = [];
  const push = gateway(async (messages) => {
    sends.push(messages);
    return sends.length === 1 ? [{ status: 'ok', id: 'first' }, { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } }]
      : [{ status: 'ok', id: 'second' }];
  });
  await dispatchNotifications(db, push, now);
  await dispatchNotifications(db, push, at(60000));
  assert.equal(sends[0].length, 2);
  assert.equal(sends[1].length, 1);
  assert.equal(sends[1][0].to, 'ExpoPushToken[second]');
  assert.equal((await db.doc('notificationJobs/due').get()).data().acceptedCount, 2);
});

test('invalid tickets remove stale device tokens; receipt cleanup preserves refreshed tokens', async () => {
  await db.doc('announcements/due').set(announcement());
  await db.doc('devices/a').set(device());
  await publishDueAnnouncements(db, now);
  await dispatchNotifications(db, gateway(async () => [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }]), now);
  assert.equal((await db.doc('devices/a').get()).exists, false);
  await db.doc('devices/a').set(device('ExpoPushToken[new-token]'));
  await db.doc('devices/b').set(device('ExpoPushToken[old-token]'));
  for (const [id, uid] of [['old-a', 'a'], ['old-b', 'b']]) {
    await db.doc(`notificationReceipts/${id}`).set({ jobId: 'due', uid, token: 'ExpoPushToken[old-token]', status: 'pending', sentAt: now,
      nextAttemptAt: at(RECEIPT_DELAY_MS), attempts: 0, leaseOwner: '', leaseUntil: Timestamp.fromMillis(0) });
  }
  const receipts = gateway(async () => [], async (ids) => Object.fromEntries(ids.map((id) => [id, { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }])));
  await checkNotificationReceipts(db, receipts, at(RECEIPT_DELAY_MS));
  assert.equal((await db.doc('devices/a').get()).data().expoPushToken, 'ExpoPushToken[new-token]');
  assert.equal((await db.doc('devices/b').get()).exists, false);
  assert.equal((await db.doc('notificationReceipts/old-a').get()).data().status, 'failed');
});

test('archive cancels pending delivery and active leases prevent concurrent dispatch', async () => {
  await db.doc('announcements/due').set(announcement());
  await db.doc('devices/a').set(device());
  await publishDueAnnouncements(db, now);
  let sent = 0;
  const push = gateway(async () => { sent++; return [{ status: 'ok', id: 'x' }]; });
  await db.doc('notificationJobs/due').update({ leaseOwner: 'other-worker', leaseUntil: at(LEASE_MS) });
  await dispatchNotifications(db, push, now);
  assert.equal(sent, 0);
  await db.doc('announcements/due').update({ status: 'archived' });
  await dispatchNotifications(db, push, at(LEASE_MS + 1));
  assert.equal(sent, 0);
  assert.equal((await db.doc('notificationJobs/due').get()).data().status, 'cancelled');
});

test('missing receipts retry then expire; successful receipts become delivered', async () => {
  for (const id of ['missing', 'ok']) await db.doc(`notificationReceipts/${id}`).set({ jobId: 'due', uid: 'a', token,
    status: 'pending', sentAt: now, nextAttemptAt: at(RECEIPT_DELAY_MS), attempts: 0, leaseOwner: '', leaseUntil: Timestamp.fromMillis(0) });
  const receipts = gateway(async () => [], async () => ({ ok: { status: 'ok' } }));
  await checkNotificationReceipts(db, receipts, at(RECEIPT_DELAY_MS));
  assert.equal((await db.doc('notificationReceipts/missing').get()).data().status, 'pending');
  assert.equal((await db.doc('notificationReceipts/ok').get()).data().status, 'delivered');
  await checkNotificationReceipts(db, receipts, at(24 * 60 * 60000));
  assert.equal((await db.doc('notificationReceipts/missing').get()).data().status, 'expired');
});

test('archiving during an active worker stops remaining pages', async () => {
  await db.doc('announcements/due').set(announcement());
  const devices = db.batch();
  for (let i = 0; i < 101; i++) devices.set(db.doc(`devices/${String(i).padStart(4, '0')}`), device(`ExpoPushToken[device-${i}]`));
  await devices.commit();
  await publishDueAnnouncements(db, now);
  const sent = [];
  const push = gateway(async (messages) => {
    sent.push(...messages);
    await db.doc('announcements/due').update({ status: 'archived' });
    return messages.map((_, i) => ({ status: 'ok', id: `first-page-${i}` }));
  });
  await dispatchNotifications(db, push, now);
  assert.equal(sent.length, 100);
  assert.equal((await db.doc('notificationJobs/due').get()).data().status, 'cancelled');
  assert.equal((await db.doc('notificationJobs/due/batches/00000001').get()).data().recipients[0].attempts, 0);
});

test('bounded dispatch resumes the next page on the following tick, deduplicating across pages', async () => {
  await db.doc('announcements/due').set(announcement());
  for (let first = 0; first < 601; first += 400) {
    const writes = db.batch();
    for (let i = first; i < Math.min(first + 400, 601); i++) {
      writes.set(db.doc(`devices/${String(i).padStart(4, '0')}`), device(i === 600 ? 'ExpoPushToken[device-0]' : `ExpoPushToken[device-${i}]`));
    }
    await writes.commit();
  }
  await publishDueAnnouncements(db, now);
  let sent = 0;
  const push = gateway(async (messages) => messages.map(() => ({ status: 'ok', id: `page-ticket-${sent++}` })));
  await dispatchNotifications(db, push, now);
  const partial = (await db.doc('notificationJobs/due').get()).data();
  assert.equal(sent, 500);
  assert.equal(partial.status, 'pending');
  assert.equal(partial.cursor, '0499');
  assert.equal(partial.leaseOwner, '');
  await dispatchNotifications(db, push, at(60000));
  assert.equal(sent, 600);
  assert.equal((await db.doc('notificationJobs/due').get()).data().status, 'complete');
  assert.equal((await db.doc('notificationJobs/due').get()).data().acceptedCount, 600);
});
