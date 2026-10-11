import { createHash, randomUUID } from 'node:crypto';
import { FieldPath, Firestore, Timestamp, DocumentReference } from 'firebase-admin/firestore';
import { Expo, ExpoPushMessage, ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk';
import {
  LEASE_MS, MAX_PAGES_PER_RUN, MAX_SEND_ATTEMPTS, PAGE_SIZE,
  pushBody, RECEIPT_DELAY_MS, RECEIPT_EXPIRY_MS, retryDelay, ticketDisposition,
} from './policy';

export interface PushGateway {
  sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
  getPushNotificationReceiptsAsync(ids: string[]): Promise<Record<string, ExpoPushReceipt>>;
}

type Recipient = {
  uid: string;
  token: string;
  state: 'pending' | 'accepted' | 'failed' | 'skipped';
  attempts: number;
};

type Batch = { recipients: Recipient[]; nextCursor: string; terminal: boolean; };
const epoch = Timestamp.fromMillis(0);
const tokenKey = (token: string) => createHash('sha256').update(token).digest('hex');

async function removeStaleDevice(db: Firestore, uid: string, token: string): Promise<void> {
  const ref = db.collection('devices').doc(uid);
  await db.runTransaction(async (tx) => {
    const device = await tx.get(ref);
    // Do not remove a newly registered token in response to an old receipt.
    if (device.data()?.expoPushToken === token) tx.delete(ref);
  });
}

async function claimJob(db: Firestore, ref: DocumentReference, owner: string, now: Timestamp): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const job = await tx.get(ref);
    const data = job.data();
    if (!data || data.status !== 'pending' || data.nextAttemptAt.toMillis() > now.toMillis()
      || data.leaseUntil.toMillis() > now.toMillis()) return false;
    const announcement = await tx.get(db.collection('announcements').doc(data.announcementId));
    if (announcement.data()?.status !== 'published') {
      tx.update(ref, { status: 'cancelled', leaseOwner: '', leaseUntil: epoch });
      return false;
    }
    tx.update(ref, { leaseOwner: owner, leaseUntil: Timestamp.fromMillis(now.toMillis() + LEASE_MS) });
    return true;
  });
}

async function stagePage(db: Firestore, ref: DocumentReference, owner: string, now: Timestamp): Promise<DocumentReference | null> {
  const jobSnapshot = await ref.get();
  const job = jobSnapshot.data()!;
  if (job.activeBatch) return ref.collection('batches').doc(job.activeBatch);
  let query = db.collection('devices').where('enabled', '==', true).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  if (job.cursor) query = query.startAfter(job.cursor);
  const page = await query.get();
  return db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data()!;
    if (current.leaseOwner !== owner) throw new Error('Job lease lost');
    if (current.activeBatch) return ref.collection('batches').doc(current.activeBatch);
    if (current.cursor !== job.cursor) throw new Error('Job cursor changed');
    if (page.empty) {
      tx.update(ref, { status: 'complete', completedAt: now, leaseOwner: '', leaseUntil: epoch });
      return null;
    }
    const unique = new Map<string, { uid: string; token: string }>();
    for (const device of page.docs) {
      const token = device.data().expoPushToken;
      if (typeof token === 'string' && Expo.isExpoPushToken(token)) unique.set(tokenKey(token), { uid: device.id, token });
    }
    const keys = [...unique.keys()];
    const seen = keys.length ? await tx.getAll(...keys.map((key) => ref.collection('tokens').doc(key))) : [];
    const recipients: Recipient[] = [];
    seen.forEach((snapshot, i) => {
      if (!snapshot.exists) recipients.push({ ...unique.get(keys[i])!, state: 'pending', attempts: 0 });
    });
    const batchId = String(current.batchNumber).padStart(8, '0');
    const batchRef = ref.collection('batches').doc(batchId);
    // Persist recipient list before contacting Expo. Retry resumes this same list.
    tx.create(batchRef, {
      recipients, nextCursor: page.docs[page.docs.length - 1].id,
      terminal: page.size < PAGE_SIZE, createdAt: now,
    });
    seen.forEach((snapshot) => { if (!snapshot.exists) tx.create(snapshot.ref, { createdAt: now, batchId }); });
    tx.update(ref, { activeBatch: batchId, leaseUntil: Timestamp.fromMillis(now.toMillis() + LEASE_MS) });
    return batchRef;
  });
}

async function deliverBatch(db: Firestore, gateway: PushGateway, ref: DocumentReference,
  batchRef: DocumentReference, owner: string, now: Timestamp): Promise<boolean> {
  const job = (await ref.get()).data()!;
  const batch = (await batchRef.get()).data() as Batch;
  const recipients = batch.recipients.map((recipient) => ({ ...recipient }));
  const pending = recipients.filter((recipient) => recipient.state === 'pending');
  // Respect opt-out/token refresh between staging and the actual send.
  const devices = pending.length ? await db.getAll(...pending.map((recipient) => db.collection('devices').doc(recipient.uid))) : [];
  const toSend: Recipient[] = [];
  pending.forEach((recipient, i) => {
    const device = devices[i].data();
    if (!device?.enabled || device.expoPushToken !== recipient.token) recipient.state = 'skipped';
    else if (recipient.attempts >= MAX_SEND_ATTEMPTS) recipient.state = 'failed';
    else { recipient.attempts += 1; toSend.push(recipient); }
  });
  // Count an attempted HTTP request durably, even if it ends ambiguously.
  const canSend = await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data()!;
    if (current.leaseOwner !== owner) throw new Error('Job lease lost');
    const announcement = await tx.get(db.collection('announcements').doc(current.announcementId));
    if (announcement.data()?.status !== 'published') {
      tx.update(ref, { status: 'cancelled', leaseOwner: '', leaseUntil: epoch });
      return false;
    }
    tx.update(batchRef, { recipients });
    tx.update(ref, { leaseUntil: Timestamp.fromMillis(now.toMillis() + LEASE_MS) });
    return true;
  });
  if (!canSend) return false;
  const messages: ExpoPushMessage[] = toSend.map((recipient) => ({
    to: recipient.token, title: job.payload.title, body: pushBody(job.payload.body),
    sound: 'default', channelId: 'announcements', data: { announcementId: job.announcementId },
  }));
  const tickets = messages.length ? await gateway.sendPushNotificationsAsync(messages) : [];
  if (tickets.length !== messages.length) throw new Error('Expo ticket count does not match recipient count');
  const receipts: { id: string; recipient: Recipient }[] = [];
  const remove: Recipient[] = [];
  tickets.forEach((ticket, i) => {
    const recipient = toSend[i];
    if (ticket.status === 'ok') {
      recipient.state = 'accepted';
      receipts.push({ id: ticket.id, recipient });
    } else {
      const disposition = ticketDisposition(ticket.details?.error);
      if (disposition === 'remove') remove.push(recipient);
      if (disposition !== 'retry' || recipient.attempts >= MAX_SEND_ATTEMPTS) recipient.state = 'failed';
      console.error('Expo rejected announcement delivery', { jobId: ref.id, error: ticket.details?.error ?? 'unknown' });
    }
  });
  const unfinished = recipients.some((recipient) => recipient.state === 'pending');
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data()!;
    if (current.leaseOwner !== owner) throw new Error('Job lease lost after Expo request');
    tx.update(batchRef, { recipients, ...(unfinished ? {} : { completedAt: now }) });
    for (const receipt of receipts) {
      tx.set(db.collection('notificationReceipts').doc(receipt.id), {
        jobId: ref.id, uid: receipt.recipient.uid, token: receipt.recipient.token,
        status: 'pending', sentAt: now, nextAttemptAt: Timestamp.fromMillis(now.toMillis() + RECEIPT_DELAY_MS),
        attempts: 0, leaseOwner: '', leaseUntil: epoch,
      });
    }
    if (unfinished) {
      const attempts = Math.max(...recipients.map((recipient) => recipient.attempts));
      tx.update(ref, { nextAttemptAt: Timestamp.fromMillis(now.toMillis() + retryDelay(attempts)), leaseOwner: '', leaseUntil: epoch });
    } else {
      tx.update(ref, {
        cursor: batch.nextCursor, batchNumber: current.batchNumber + 1, activeBatch: null,
        errorAttempts: 0,
        acceptedCount: current.acceptedCount + recipients.filter((recipient) => recipient.state === 'accepted').length,
        failedCount: current.failedCount + recipients.filter((recipient) => recipient.state === 'failed').length,
        ...(batch.terminal ? { status: 'complete', completedAt: now, leaseOwner: '', leaseUntil: epoch } : {}),
      });
    }
  });
  await Promise.all(remove.map((recipient) => removeStaleDevice(db, recipient.uid, recipient.token)));
  return !unfinished && !batch.terminal;
}

/** Bounded work: at most ten jobs, five pages per job, 100 tokens per page. */
export async function dispatchNotifications(db: Firestore, gateway: PushGateway, now = Timestamp.now()): Promise<void> {
  const due = await db.collection('notificationJobs').where('status', '==', 'pending')
    .where('nextAttemptAt', '<=', now).orderBy('nextAttemptAt').limit(10).get();
  for (const job of due.docs) {
    const owner = randomUUID();
    if (!await claimJob(db, job.ref, owner, now)) continue;
    try {
      for (let page = 0; page < MAX_PAGES_PER_RUN; page += 1) {
        const batch = await stagePage(db, job.ref, owner, now);
        if (!batch || !await deliverBatch(db, gateway, job.ref, batch, owner, now)) break;
      }
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(job.ref)).data()!;
        if (current.leaseOwner === owner) tx.update(job.ref, { leaseOwner: '', leaseUntil: epoch, nextAttemptAt: now });
      });
    } catch (error) {
      console.error('Announcement dispatch deferred', { jobId: job.id, errorType: error instanceof Error ? error.name : 'unknown' });
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(job.ref)).data()!;
        if (current.leaseOwner !== owner) return;
        const attempts = current.errorAttempts + 1;
        tx.update(job.ref, {
          errorAttempts: attempts, leaseOwner: '', leaseUntil: epoch,
          nextAttemptAt: Timestamp.fromMillis(now.toMillis() + retryDelay(attempts)),
          ...(attempts >= 10 ? { status: 'failed', failedAt: now } : {}),
        });
      });
    }
  }
}

/** Tickets are checked after fifteen minutes, with bounded retries before Expo expires receipts. */
export async function checkNotificationReceipts(db: Firestore, gateway: PushGateway, now = Timestamp.now()): Promise<void> {
  const due = await db.collection('notificationReceipts').where('status', '==', 'pending')
    .where('nextAttemptAt', '<=', now).orderBy('nextAttemptAt').limit(300).get();
  const owner = randomUUID();
  const claimed: typeof due.docs = [];
  for (const receipt of due.docs) {
    const acquired = await db.runTransaction(async (tx) => {
      const data = (await tx.get(receipt.ref)).data()!;
      if (data.status !== 'pending' || data.leaseUntil.toMillis() > now.toMillis()) return false;
      tx.update(receipt.ref, { leaseOwner: owner, leaseUntil: Timestamp.fromMillis(now.toMillis() + LEASE_MS) });
      return true;
    });
    if (acquired) claimed.push(receipt);
  }
  if (!claimed.length) return;
  let results: Record<string, ExpoPushReceipt> = {};
  try { results = await gateway.getPushNotificationReceiptsAsync(claimed.map((receipt) => receipt.id)); }
  catch { console.error('Expo receipt lookup failed; pending receipts will retry.'); }
  for (const receipt of claimed) {
    const data = receipt.data();
    const result = results[receipt.id];
    if (result?.status === 'error' && result.details?.error === 'DeviceNotRegistered') {
      await removeStaleDevice(db, data.uid, data.token);
    }
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(receipt.ref)).data()!;
      if (current.leaseOwner !== owner) return;
      const expired = now.toMillis() - current.sentAt.toMillis() >= RECEIPT_EXPIRY_MS;
      tx.update(receipt.ref, {
        status: result ? (result.status === 'ok' ? 'delivered' : 'failed') : expired ? 'expired' : 'pending',
        attempts: current.attempts + 1, leaseOwner: '', leaseUntil: epoch,
        nextAttemptAt: Timestamp.fromMillis(now.toMillis() + RECEIPT_DELAY_MS),
        ...(result?.status === 'error' ? { error: result.details?.error ?? result.message } : {}),
      });
    });
  }
}
