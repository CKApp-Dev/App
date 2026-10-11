import { Firestore } from 'firebase-admin/firestore';
import { Expo } from 'expo-server-sdk';
import { checkNotificationReceipts, dispatchNotifications, PushGateway } from './delivery';
import { publishDueAnnouncements } from './publisher';

/** A single bounded pass. The external scheduler invokes this again for remaining work. */
export async function runNotificationWorker(db: Firestore, gateway: PushGateway): Promise<void> {
  const published = await publishDueAnnouncements(db);
  console.info('Announcements published', { count: published });
  await dispatchNotifications(db, gateway);
  await checkNotificationReceipts(db, gateway);
}

async function main(): Promise<void> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!projectId?.trim()) throw new Error('Set GOOGLE_CLOUD_PROJECT to the intended Firebase project ID.');
  // This is the Google Cloud Firestore client exported by firebase-admin, using ADC.
  // It supports the external-account credentials from google-github-actions/auth.
  // The worker needs Firestore IAM access only and never calls Firebase Authentication.
  const db = new Firestore({ projectId });
  const gateway = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined, maxConcurrentRequests: 2 });
  try { await runNotificationWorker(db, gateway); }
  finally { await db.terminate(); }
}

if (require.main === module) {
  main().catch(() => {
    // Provider error objects may contain credentials: never print them in public Actions logs.
    console.error('Announcement worker failed. Check project access, workload identity, and Firestore availability.');
    process.exitCode = 1;
  });
}
