# iPhone push setup and Account Holder handoff

The Account Holder completed local Apple sign-in on 2026-10-11. Expo now has
APNs key `XNF4WWTXKH` assigned to CK APP's main app identifier for team
`FJX3SGU9AL`. The key's private material stays in Expo credential storage.
Push Notifications is enabled on the main identifier. Both identifiers now
share the required App Group, and their validated App Store profiles are
uploaded to the GitHub Actions secrets below. The profiles use the existing CI
distribution certificate, verified by its public fingerprint. That certificate
expires at 2026-10-16 00:41 (Asia/Taipei); renew it before then for later builds.

The new iOS build, version `4.0.0 (77)`, was archived, exported, and uploaded to
TestFlight successfully from
`notifications/ios-push-20261011`, commit
`01be7c7edeff394287383986f1ad51043f451ed4`, in
[GitHub Actions run 38136940451](https://github.com/CKApp-Dev/App/actions/runs/38136940451).
The user installed the TestFlight build and enabled notifications; the physical
iPhone's enabled push registration is verified in Firestore. A single test
notification arrived while the iPhone was locked, its Expo receipt confirmed
provider acceptance, and tapping it opened CK APP. The scheduled notification
publisher is separately blocked by missing Google IAM setup permissions.

If another operator needs access later: for an Individual membership, invited
App Store Connect users do not receive Apple Developer Program team access.
For an Organization membership, an Admin
normally has Certificates, Identifiers & Profiles access; the Account Holder
should verify the operator's Apple Account, accepted invitation, active
membership, and any pending program agreements. See Apple's
[roles and access](https://developer.apple.com/help/account/access/roles).

## Project identifiers

| Setting | Value |
| --- | --- |
| Apple team | `FJX3SGU9AL` |
| Main app identifier | `org.capacitor.quasar.ckapp` |
| Widget identifier | `org.capacitor.quasar.ckapp.ExpoWidgetsTarget` |
| Shared App Group | `group.org.capacitor.quasar.ckapp` |
| Expo project | `@ckappofficial/ck-app` |
| EAS project UUID | `8961c130-925c-4100-b7a9-67d0e4bf6868` |
| App repository | [CKApp-Dev/App](https://github.com/CKApp-Dev/App) |

## Prepare Apple credentials

The Account Holder, or an Organization Admin with working developer-resource
access, completes these steps in the Apple Developer portal:

1. In [Keys](https://developer.apple.com/account/resources/authkeys/list), use
   an existing available APNs private key or create a key with Apple Push
   Notifications service enabled. Ensure it supports **Production** delivery
   for TestFlight and App Store builds. Record its Key ID and download its
   `.p8` private key. Keep the private key outside source control and chat.
   If Apple's key limit is reached, locate an existing key's original file
   before considering any revocation. See
   [Apple key creation](https://developer.apple.com/help/account/keys/create-a-private-key/).
2. In Identifiers, enable **Push Notifications** on the existing main app
   identifier. Ensure the main app and widget identifier both have the shared
   App Group above, preserving their other capabilities and group memberships.
3. Regenerate and download the main app's **App Store distribution** profile
   named exactly `Github Actions`, using its existing distribution certificate.
   Its entitlements must include `aps-environment = production` and the shared
   App Group.
4. Create or refresh the widget's App Store distribution profile for its exact
   identifier, using the same existing distribution certificate and App Group.
   Download that `.mobileprovision` file too. The build requires both profiles.

## Complete Expo and GitHub setup

The Expo operator can upload the `.p8` file through `eas credentials -p ios`
without Apple login: decline Apple sign-in, choose Push Notifications, then
set up the project with a supplied key instead of generating one. Enter the
Key ID from Apple's key details and team `FJX3SGU9AL`. Assign it to the main
app identifier in `@ckappofficial/ck-app`. Expo cannot validate the key against
Apple's portal when Apple login is skipped; production delivery still needs
a device test. See [Expo credential management](https://docs.expo.dev/app-signing/managed-credentials/).

Validate both downloaded profiles before updating these repository secrets:

| GitHub Actions secret | Value |
| --- | --- |
| `BUILD_PROVISION_PROFILE_BASE64` | Base64 of the main app's `.mobileprovision` file |
| `BUILD_WIDGET_PROVISION_PROFILE_BASE64` | Base64 of the widget's `.mobileprovision` file |

Both profiles must belong to the specified team, remain unexpired, target their
exact identifiers, include the shared App Group, and use the existing CI
signing certificate. Keep the existing certificate and signing-password
secrets unless separate certificate maintenance is required.

After credential and profile verification, build the intended app branch with
the iOS workflow, install the resulting TestFlight build on a physical iPhone,
enable Settings → 公告通知, and verify a new announcement arrives while the
app is closed. The notification publisher must also be active for this test.
