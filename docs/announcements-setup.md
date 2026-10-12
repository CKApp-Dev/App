# Announcements and system notifications

The home screen reads published announcements from the supplied Firebase
project, `ck-app-database`. Administrators use the separate
[admin project](https://github.com/CKApp-Dev/Notification)
to save drafts or future publication times in **Asia/Taipei**. Publication and
remote device notifications start only when an administrator presses **立即發布**
or **處理待發布公告與通知**. Drafts and future-time saves never invoke the worker;
future-dated announcements require a manual action after their due time.
The admin project prepares an authenticated Cloud Run endpoint with zero minimum
instances. GitHub Actions retains manual **Run workflow** as an operator fallback;
neither path has a five-minute cron trigger. Source changes alone do not deploy
the endpoint or disable previously deployed schedules.

The button-only backend and website were deployed on 2026-10-12; see the
[current deployment verification](announcements-deployment-status.md).

## Projects

| Project | Source | Purpose |
| --- | --- | --- |
| Expo mobile app | repository root | Published feed, detail, unread state, notification permission and tap routing |
| Admin website | [Notification repository root](https://github.com/CKApp-Dev/Notification) | Google sign-in, owner-managed account invitations, authoring, preview, scheduling, archive |
| Firebase / Actions worker | [Notification `firebase/`](https://github.com/CKApp-Dev/Notification/tree/main/firebase) | Rules, indexes, manual publication, push delivery and receipts |

The admin website, backend, deployment workflows, and their tests are maintained
in `CKApp-Dev/Notification`. This repository contains the mobile app and its
public configuration.

The mobile app's public Firebase configuration lives in
`config/firebase.public.json`; the admin repository has its own
[`src/firebase-config.json`](https://github.com/CKApp-Dev/Notification/blob/main/src/firebase-config.json).
These identify the existing Firebase web app; they do not authorize
administrators. Never add service-account keys or OAuth tokens to either
frontend. Google sign-in alone grants no publishing access.

## Backend setup

1. In Firebase console, initialize Authentication and enable **Google** and
   **Anonymous** sign-in. Set the Google provider's support email. Add
   `notification.cksc.tw` to authorized domains. The mobile app uses
   Anonymous sign-in to register each device for notifications.
2. From the separate admin repository, deploy rules/indexes and configure the
   manual publication service following its
   [backend guide](https://github.com/CKApp-Dev/Notification/blob/main/firebase/README.md).
   The Cloud Run endpoint verifies Firebase administrator ID tokens. The
   optional manual Actions worker uses short-lived credentials through Workload
   Identity Federation. No service-account key is committed. Existing Firestore data is
   retained; private legacy collections remain unavailable to clients under
   the default-deny rules.
3. Follow that repository's
   [administrator setup](https://github.com/CKApp-Dev/Notification#readme)
   to grant an owner access and invite announcement authors.

The standalone admin source and worker are published in
[CKApp-Dev/Notification](https://github.com/CKApp-Dev/Notification).
The [admin website](https://notification.cksc.tw) uses the `notification.cksc.tw`
domain. Configure Firebase authorized domains and the publication service
separately; deploying the website does not activate publication or push delivery.
Set the admin website's public `VITE_ANNOUNCEMENTS_WORKER_URL` repository variable
to the deployed HTTPS `/run` endpoint. During rollout, remove the old GitHub cron
from the default branch and pause any existing Cloud Scheduler job. A worker pass
can leave large deliveries, retries or receipts for later manual processing;
HTTP success does not guarantee that every phone displayed a notification.

## Native push setup

1. CK APP is linked to `@ckappofficial/ck-app`, UUID
   `8961c130-925c-4100-b7a9-67d0e4bf6868`, in `config/expo-project.json`.
   `EAS_PROJECT_ID` in `.env.local` or GitHub Actions can override it for a
   separate environment. The EAS UUID differs from the Firebase project ID.
2. The public Android SDK config defaults to `config/google-services.json` for
   Firebase project `ck-app-database`. Both the release package
   `org.capacitor.quasar.ckapp` and debug package
   `org.capacitor.quasar.ckapp.dev` are registered and included. These SDK identifiers
   contain no service-account private key. `GOOGLE_SERVICES_JSON` can override
   the file for another environment. The optional
   `FIREBASE_GOOGLE_SERVICES_JSON` GitHub Actions secret overrides the committed
   public config at build time.
3. Configure this EAS project's Android **FCM v1 service-account credential**
   and iOS **APNs push credential** with `eas credentials`. These are
   server-side credentials and must not enter the app bundle or source repo.
   FCM v1 credential upload is still required; associate it with both Android
   application identifiers when testing release and debug builds.
   As of 2026-10-11, APNs key `XNF4WWTXKH` is assigned to the iOS app in EAS
   for Apple team `FJX3SGU9AL`. Push Notifications is enabled on the main
   identifier, both app identifiers share the required App Group, and the
   validated app/widget distribution profiles are uploaded to GitHub Actions.
   Production delivery and notification tap routing passed a locked-iPhone
   test on TestFlight `4.0.0 (77)`. The existing distribution
   certificate expires at 2026-10-16 00:41 (Asia/Taipei) and must be renewed
   for later builds.
   Local iOS builds default to `IOS_PUSH_ENVIRONMENT=development`; release CI
   sets `production` and verifies that the profile has that APNs entitlement.
   For future credential maintenance, or if Apple denies developer access, use the
   [Account Holder handoff](ios-push-handoff.md) to obtain the key and both
   signing profiles, then upload the supplied key without Apple login.
4. Regenerate native projects and rebuild the app. Changing JavaScript alone
   cannot add the native notifications module or signing entitlement. Expo Go
   is insufficient for this flow; use native development/release builds on
   physical Android and iOS devices.
5. If Expo push access protection is enabled, configure the backend secret in
   the admin repository as described in its
   [backend guide](https://github.com/CKApp-Dev/Notification/blob/main/firebase/README.md).
   Otherwise leave the flag unset.

New installs enable announcements by default and automatically request system
notification permission on first entering the app in the foreground. Users
still need to accept the system prompt. Saved notification choices are
preserved, and a denied or revoked permission does not trigger another
automatic prompt. Settings → 公告通知 lets users disable notifications or
explicitly retry permission setup. Anonymous Auth uses SQLite-backed persistence to keep the
same device identity across launches. Disable requests are persisted and
retried after offline failures. Foreground reconciliation handles changes to
OS permission and native-token rotation. Firestore snapshots never generate
local alerts, so opening the app does not replay old announcements as pushes.

## Release verification

- In this repository's root, run `yarn typecheck`, `yarn test --runInBand`, and
  `yarn lint`.
- In the separate admin repository's root, run `npm test` and `npm run build`.
- In the admin repository's `firebase/` directory, run `npm test` and
  `npm run test:emulator` (Java 21+).
- Verify on both native platforms, including dark mode and larger text sizes.
  Save a future announcement; it must remain invisible until an administrator
  explicitly processes it after its due time. Verify page load, draft saves and
  future-time saves make no worker request, and Publish makes one request.
  Confirm Home publication and notification of an opted-in closed app separately.
  Tap from a cold start, deny permission, disable offline, rotate a token,
  and archive an announcement while its detail is open.

Push delivery is at least once. Provider delivery/OS display is not guaranteed,
and a crash after provider acceptance may cause a duplicate. Reinstalling or
clearing app storage loses the previous anonymous device identity; system
permission still controls notification display, but abandoned backend
registrations may persist until the provider invalidates them.
