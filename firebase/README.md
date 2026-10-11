# Scheduled announcements with GitHub Actions

The app and admin website share Firestore in `ck-app-database`. A Node worker in `firebase/worker` publishes scheduled announcements and sends remote device notifications. GitHub Actions runs the worker every five minutes, so this design does not require Cloud Functions, Cloud Scheduler, or a Firebase Blaze upgrade. Firestore and Authentication remain subject to Spark quotas. Standard GitHub-hosted runners are free for public repositories; private repositories have an Actions allowance. See [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) and [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

The independent admin repository is `ChrisSun0731/CK-App-Admin`: its root contains the website and this entire `firebase/` directory lives beneath it. Copy `github-actions/announcements.yml` to that repository's `.github/workflows/announcements.yml` and keep `main` as its default branch.

## Publication and delivery

Administrators sign in with Google. A verified Google account receives announcement access through an enabled email invitation in `adminAccounts`; existing `admin: true` Firebase Auth custom claims also grant access. They create drafts/schedules in `announcements/{id}` with `title`, `body`, `url`, `status`, `publishAt`, `publishedAt`, `createdAt`, `updatedAt`, and `createdBy`. Dates are Firestore timestamps; empty links or HTTPS links are allowed. Public reads require `status == published`, ordered by `publishAt` descending, limited to 50 by the app. Drafts/schedules stay private even after their publication date passes. Admins can edit pending rows or archive published rows, without rewriting or republishing history.

## Administrator accounts

The website's owner invites Google accounts by email before they sign in. Invitations live at `adminAccounts/{normalizedLowercaseEmail}` and contain exactly `email` (matching the document ID), `displayName` (up to 120 characters, empty allowed), `enabled` (boolean), `createdAt`, `updatedAt` (Firestore timestamps), and `createdBy` (the creating owner's UID). Creation uses server timestamps for both dates and the current owner's UID. Updates preserve `email`, `createdAt`, and `createdBy`, and set `updatedAt` with a server timestamp. Owners may delete invitations.

Only an account with both server-issued custom claims `admin: true` and `accountManager: true` can list or manage invitations. An invitation cannot confer account-management privileges. Verified Google users can get their own normalized-email invitation, including a disabled or missing row, but cannot list invitations or read other accounts. Their Google sign-in token must have `email_verified: true` and provider `google.com`.

Enabling an invitation grants announcement access without a token refresh; disabling or deleting it revokes access on subsequent Firestore server requests using the same signed-in account. Already downloaded data cannot be recalled. The website listens to the user's own invitation to update its interface. Existing server-issued `admin: true` claims remain independent of invitations, so disabling an invitation does not revoke a claim holder. An authorized Firebase Auth operator must remove those claims separately. The owner's server-issued claims keep account management accessible even if their own invitation is disabled or deleted.

Each worker pass sequentially:

1. Publishes up to 100 due schedules using server time and transactions, creating exactly one immutable push payload in `notificationJobs/{id}`.
2. Dispatches up to ten pending jobs, five pages of 100 tokens per job, with durable progress and retries.
3. Checks up to 300 due Expo push receipts, beginning 15 minutes after their tickets were accepted.

The Actions schedule uses UTC minutes 2, 7, 12, and so on. Publication and push usually happen on the next successful run after `publishAt`, approximately within five minutes plus runner startup and provider delays. GitHub can delay or drop scheduled runs, runs schedules only from the default branch, and automatically disables scheduled workflows in public repositories after 60 days without repository activity. Check Actions periodically and use **Run workflow** to catch up when needed. This is a best-effort schedule, without an exact publication-time guarantee. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

The workflow allows only `main` in the intended repository, uses a shared concurrency group with `cancel-in-progress: false`, and gives each worker step four minutes to finish within short-lived Google credentials. Interrupted work resumes on later runs after its six-minute lease expires. A running worker is not cancelled when a newer run arrives.

Phones sign in anonymously only to register `devices/{uid}` (`expoPushToken`, `platform`, `enabled`, `updatedAt`). Rules permit a device to manage only its own registration; clients, including admins, cannot list tokens or access jobs/receipts. Expo pushes include visible title/body, `sound: default`, Android channel `announcements`, and data `{ announcementId }`, allowing notifications while the app is closed.

Delivery persists recipient batches before sending, deduplicates tokens within a job, checks current opt-out/token state, and checkpoints accepted tickets. Transient failures use capped exponential backoff. Previously accepted tokens are excluded from ordinary retries. Five attempts per token or ten consecutive job errors leave failures available for operator inspection. Before every batch the worker rechecks publication status; archives stop remaining batches, while a request already being submitted cannot be recalled.

`DeviceNotRegistered` tickets/receipts remove a device only if it still has the rejected token. Missing receipts retry until 23 hours old. Receipt state `delivered` means APNs/FCM accepted the push, not that the phone displayed it. Device permissions, connectivity, and operating-system settings affect display.

Delivery is at least once: Expo may accept a request just before a worker crash prevents ticket persistence, creating a small duplicate window on retry. Expo itself also allows duplicates. Leases, token deduplication and checkpoints reduce duplicates but cannot guarantee exactly-once remote delivery.

## Install and test

Use Node 22.12+, Java 21+, and the Firebase CLI:

```sh
cd firebase
npm --prefix worker ci --ignore-scripts
npm test
npm run test:emulator
```

The emulator always uses `demo-ck-announcements`, never production. Tests cover due dates, concurrent workers, draft privacy, history immutability, invitation access and revocation, prevention of account privilege escalation, own-device access, retry checkpoints, receipt cleanup, archives during delivery, and more than 500 devices resuming across runs. They use a fake Expo gateway and send no real notifications. The test SDK's older gRPC dependency is overridden with compatible `@grpc/grpc-js` 1.14.6+ to address advisories.

## Deploy Firestore and configure mobile

Enable Firebase Authentication **Google** for administrators and **Anonymous** for mobile registration. Add the website's deployed domain to Firebase Authentication's authorized domains. Configure the Firebase web values in both frontends. Deploy database rules and indexes only:

```sh
cd firebase
firebase deploy --project ck-app-database --only firestore
```

Index creation may take several minutes. Enable notifications in a development/release mobile build with a real EAS project ID, Android FCM v1 credentials and iOS APNs credentials. Test on physical devices with permission granted; Expo Go does not support this remote-push flow.

## GitHub Actions keyless authentication

The scheduled worker needs Firestore IAM access only. Use Workload Identity Federation (WIF) **through a dedicated service account**. The auth action creates an ADC credential configuration and exports `GOOGLE_APPLICATION_CREDENTIALS`; the worker's underlying Google Cloud Firestore client consumes it. The worker does not call Firebase Auth. Keep the private admin-grant script below separate from this service account. See [Google's WIF setup](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [the auth action](https://github.com/google-github-actions/auth), and [Firestore ADC](https://firebase.google.com/docs/firestore/quickstart-server).

An authorized project operator runs the following setup locally after the admin repository exists. Project/IAM administration permissions are needed for this one-time setup; the worker receives only data access. These commands create IAM resources and enable free authentication/data APIs, without deploying a paid compute service.

The fixed-project helper `scripts/configure-github-wif.mjs --owner-id 198431597` prints a reviewable plan by default. Apply mode accepts an operator's short-lived OAuth bearer token only through piped stdin and preserves existing IAM bindings. Its one-time operator permissions require Workload Identity Pool Admin, Project IAM Admin, and Service Account Admin; these setup roles are separate from the worker's Firestore-only role and can be removed afterward.

```sh
PROJECT_ID='ck-app-database'
GITHUB_REPOSITORY='ChrisSun0731/CK-App-Admin'
GITHUB_REPOSITORY_ID="$(gh api "repos/${GITHUB_REPOSITORY}" --jq '.id')"
GITHUB_OWNER_ID="$(gh api users/ChrisSun0731 --jq '.id')"
GITHUB_WORKFLOW_REF="${GITHUB_REPOSITORY}/.github/workflows/announcements.yml@refs/heads/main"
SERVICE_ACCOUNT="ck-announcements@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable \
  firestore.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com cloudresourcemanager.googleapis.com \
  --project="${PROJECT_ID}"

gcloud iam service-accounts create ck-announcements \
  --project="${PROJECT_ID}" --display-name='Announcement worker'

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" --role='roles/datastore.user'

gcloud iam workload-identity-pools create github-announcements \
  --project="${PROJECT_ID}" --location='global' --display-name='GitHub announcements'

POOL_NAME="$(gcloud iam workload-identity-pools describe github-announcements \
  --project="${PROJECT_ID}" --location='global' --format='value(name)')"

gcloud iam workload-identity-pools providers create-oidc github-actions \
  --project="${PROJECT_ID}" --location='global' \
  --workload-identity-pool='github-announcements' \
  --issuer-uri='https://token.actions.githubusercontent.com' \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref,attribute.event_name=assertion.event_name' \
  --attribute-condition="assertion.repository_id == '${GITHUB_REPOSITORY_ID}' && assertion.repository_owner_id == '${GITHUB_OWNER_ID}' && assertion.repository == '${GITHUB_REPOSITORY}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${GITHUB_WORKFLOW_REF}' && assertion.event_name in ['schedule', 'workflow_dispatch']"

gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" --role='roles/iam.workloadIdentityUser' \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository_id/${GITHUB_REPOSITORY_ID}"

PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe github-actions \
  --project="${PROJECT_ID}" --location='global' \
  --workload-identity-pool='github-announcements' --format='value(name)')"

gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "${GITHUB_REPOSITORY}" --body "${PROVIDER_NAME}"
gh variable set GCP_SERVICE_ACCOUNT --repo "${GITHUB_REPOSITORY}" --body "${SERVICE_ACCOUNT}"
```

The numeric repository/owner IDs prevent a renamed or recreated repository from inheriting trust. The provider also restricts repository name, `main`, exact workflow path, and scheduled/manual event types. The workflow and IAM conditions must agree if any of these change. The service account gets `roles/datastore.user`; it receives no Firebase Auth administrator role. The repository identity gets `roles/iam.workloadIdentityUser` on that service account only. Do not create or commit service-account private keys. Ignore any `gha-creds-*.json` file the auth action creates, and never upload credential files as artifacts.

If Expo push access protection is enabled, add `EXPO_ACCESS_TOKEN` as a GitHub Actions **secret** in the admin repository. Leave it absent for unprotected Expo projects. The worker reads the environment variable only at runtime and never prints its value. No token belongs in a frontend environment file or the repository. Run the workflow manually once to verify WIF, publication and receipts before relying on its schedule. Keep `main` protected so unreviewed code cannot use the worker identity.

For a local manual pass with an authorized operator's ADC:

```sh
gcloud auth application-default login
GOOGLE_CLOUD_PROJECT=ck-app-database npm --prefix firebase/worker run start
```

## Android push credentials

Android FCM credentials are separate from the scheduled worker identity. The optional `scripts/configure-android-push.mjs` helper prints its plan by default and requires explicit key-creation/upload approval before apply mode. It creates a dedicated messaging-only identity, keeps its private key in memory, and uploads it only to the verified `@ckappofficial/ck-app` Expo account. It refuses unrelated existing credentials and never revokes keys automatically. iOS APNs credentials and Apple provisioning must be configured separately; see the mobile repository's announcement setup guide.

## Bootstrap an account manager privately

Ordinary administrators should use email invitations in the website. To bootstrap or recover an owner, have the intended owner sign into the website once with Google. An authorized operator with Firebase Auth administration access then runs:

```sh
cd firebase
gcloud auth application-default login
npm run grant-admin -- --project ck-app-database --email owner@example.com --account-manager
```

The script rejects disabled, unverified, or non-Google accounts and merges existing custom claims. `--account-manager` grants both `admin: true` and `accountManager: true`; omitting it grants durable announcement-admin access only. Ordinary Google sign-in never grants access without an enabled invitation or a server-issued claim. Sign out and sign in again after a custom-claim change to refresh the ID token. Firebase CLI login alone does not configure Admin SDK credentials. The scheduled worker's service account cannot perform this grant.

Inspect Actions logs and `notificationJobs` / `notificationReceipts` in the Firebase console for operational failures. After fixing a failed job's cause, an authorized operator may reset `status: pending`, `errorAttempts: 0`, `nextAttemptAt` to the current server timestamp, and pending recipients' attempts to zero. Preserve accepted recipients and token deduplication records to avoid replaying successful delivery.
