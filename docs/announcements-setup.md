# Announcements and system notifications

The home screen reads published announcements from the supplied Firebase
project, `ck-app-database`. Administrators use the separate [admin project](../admin/README.md)
to save drafts or schedule a release in **Asia/Taipei**. A GitHub Actions worker
publishes due entries and sends remote system notifications even when CK APP
is closed. It checks about every five minutes; GitHub can delay or drop runs,
and additional operating-system/provider delays are possible. This deployment
uses Firestore and Authentication without Cloud Functions or Blaze billing.

## Projects

| Project | Source | Purpose |
| --- | --- | --- |
| Expo mobile app | repository root | Published feed, detail, unread state, notification permission and tap routing |
| Admin website | `admin/` | Google sign-in, owner-managed account invitations, authoring, preview, scheduling, archive |
| Firebase / Actions worker | `firebase/` | Rules, indexes, server publication, push delivery and receipts |

Public Firebase configuration lives in `config/firebase.public.json` and
`admin/src/firebase-config.json`. These identify the existing Firebase web app;
they do not authorize administrators. Never add service-account keys or OAuth
tokens to either frontend. The intended administrator is
`chris20090731@gmail.com`; the project-management account is
`ckappofficial@gmail.com`. Google sign-in alone grants no publishing access.

## Account setup

1. In Firebase console, initialize Authentication and enable **Google** and
   **Anonymous** sign-in. Set the Google provider's support email. Add the
   deployed admin site's host to authorized domains.
2. Deploy rules/indexes and configure the GitHub Actions worker following
   `firebase/README.md`. The worker uses short-lived Google credentials through
   Workload Identity Federation. No service-account key is committed. Existing
   Firestore data is retained; private legacy collections remain unavailable
   to clients under the new default-deny rules.
3. Have the intended owner sign in once, then bootstrap their verified Google
   user with `admin: true` and `accountManager: true` using the explicit-email
   script's `--account-manager` option. Refresh permissions on the website or
   sign out/in. The owner can then use **帳戶管理** to invite other Google
   emails, edit names, disable access, or remove invitations. Invitations do
   not send email; share the admin website link with each invited person.
   Their Firebase Auth account is created on first Google sign-in. Disabled
   invitations revoke the access that they granted; independent custom claims
   require a trusted operator to remove.

The standalone admin source and worker are published in
[ChrisSun0731/CK-App-Admin](https://github.com/ChrisSun0731/CK-App-Admin).
The [admin website](https://chrissun0731.github.io/CK-App-Admin/) runs on GitHub
Pages, and Actions runs the worker. Public repositories automatically disable scheduled workflows after
60 days without repository activity, so monitor the worker and re-enable it
if needed. Manual workflow dispatch provides an immediate retry.

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
   application identifiers when testing release and debug builds. The linked
   EAS project and account currently have no iOS APNs key. Upload an existing
   APNs `.p8` key with its Key ID and Apple team `FJX3SGU9AL`, or log in to that
   Apple Developer account through `eas credentials -p ios` to create one.
   Enable Push Notifications on the existing Apple app identifier, regenerate
   its provisioning profile, and update the existing CI profile secret.
   Local iOS builds default to `IOS_PUSH_ENVIRONMENT=development`; release CI
   sets `production` and verifies that the profile has that APNs entitlement.
4. Regenerate native projects and rebuild the app. Changing JavaScript alone
   cannot add the native notifications module or signing entitlement. Expo Go
   is insufficient for this flow; use native development/release builds on
   physical Android and iOS devices.
5. If Expo push access protection is enabled, configure the backend secret as
   described in `firebase/README.md`. Otherwise leave the flag unset.

The user explicitly opts in from Settings → 公告通知. Startup never opens a
permission prompt. Anonymous Auth uses SQLite-backed persistence to keep the
same device identity across launches. Disable requests are persisted and
retried after offline failures. Foreground reconciliation handles changes to
OS permission and native-token rotation. Firestore snapshots never generate
local alerts, so opening the app does not replay old announcements as pushes.

## Release verification

- Run root `yarn typecheck`, `yarn test --runInBand`, and `yarn lint`.
- Run admin `npm test` and `npm run build`.
- Run backend `npm test` and `npm run test:emulator` (Java 21+).
- Verify on both native platforms, including dark mode and larger text sizes.
  Schedule an announcement ahead; it must remain invisible before release,
  appear on Home afterward, and notify an opted-in device with the app closed.
  Tap from a cold start, deny permission, disable offline, rotate a token,
  and archive an announcement while its detail is open.

Push delivery is at least once. Provider delivery/OS display is not guaranteed,
and a crash after provider acceptance may cause a duplicate. Reinstalling or
clearing app storage loses the previous anonymous device identity; system
permission still controls notification display, but abandoned backend
registrations may persist until the provider invalidates them.
