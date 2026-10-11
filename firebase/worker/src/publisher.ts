import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { shouldPublish } from './policy';

/** Re-check inside the transaction: concurrent scheduler runs create one outbox job. */
export async function publishDueAnnouncements(db: Firestore, now = Timestamp.now()): Promise<number> {
  const due = await db.collection('announcements')
    .where('status', '==', 'scheduled').where('publishAt', '<=', now)
    .orderBy('publishAt').limit(100).get();
  let published = 0;
  for (const candidate of due.docs) {
    const didPublish = await db.runTransaction(async (tx) => {
      const current = await tx.get(candidate.ref);
      const data = current.data();
      if (!data || !(data.publishAt instanceof Timestamp)
        || !shouldPublish(data.status, data.publishAt.toMillis(), now.toMillis())) return false;
      const jobRef = db.collection('notificationJobs').doc(candidate.id);
      const job = await tx.get(jobRef);
      // Existing outbox IDs are never reused, even after administrative mistakes.
      if (job.exists) return false;
      tx.update(candidate.ref, { status: 'published', publishedAt: now, updatedAt: now });
      tx.create(jobRef, {
        announcementId: candidate.id,
        payload: { title: data.title, body: data.body, url: data.url },
        status: 'pending', createdAt: now, nextAttemptAt: now,
        cursor: '', batchNumber: 0, activeBatch: null,
        leaseOwner: '', leaseUntil: Timestamp.fromMillis(0),
        errorAttempts: 0, acceptedCount: 0, failedCount: 0,
      });
      return true;
    });
    if (didPublish) published += 1;
  }
  return published;
}
