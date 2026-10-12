import type { ConfigContext, ExpoConfig } from 'expo/config';

import pkg from './package.json';
import firebaseConfig from './config/firebase.public.json';
import expoProject from './config/expo-project.json';

// Values that differ per build come from the environment. Locally, Expo CLI
// loads them from `.env.local` (see `.env.example`); in CI they come from the
// workflow (see .github/workflows).
//
// APP_VERSION / BUILD_NUMBER: CI derives these from the release tag and the
// workflow run number, so store builds always increase. Local builds fall back
// to package.json and build 1.
const version = process.env.APP_VERSION || pkg.version;
const buildNumber = process.env.BUILD_NUMBER || '1';

// The 現在 widget (src/widgets/) adds a widget extension target and an App
// Group (group.<bundle id>) to the iOS app. Include it in normal builds so
// iPhone users can find CK APP in the widget gallery. ENABLE_WIDGETS=0 is a
// local opt-out for signing setups without App Groups; release CI signs both
// the app and extension. See docs/design/native-ui.md, "Widgets".
const widgets = process.env.ENABLE_WIDGETS !== '0';

// Local device builds use APNs sandbox; the signed release workflow sets
// production to match its Apple Distribution provisioning profile.
const iosPushEnvironment = process.env.IOS_PUSH_ENVIRONMENT || 'development';
if (iosPushEnvironment !== 'development' && iosPushEnvironment !== 'production') {
  throw new Error('IOS_PUSH_ENVIRONMENT must be development or production.');
}

// The store identity is inherited from the original Capacitor app. Changing it
// would publish a brand-new app instead of an update to the existing one.
const APP_ID = 'org.capacitor.quasar.ckapp';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CK APP',
  slug: 'ck-app',
  owner: expoProject.owner,
  version,
  platforms: ['ios', 'android'],
  scheme: 'ckapp',
  // The previous app allowed landscape on iPhone and every orientation on
  // iPad, and iPad multitasking requires all four.
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APP_ID,
    appleTeamId: process.env.IOS_TEAM_ID || undefined,
    buildNumber,
    icon: './assets/icons/apple.icon',
    // The shipped app supports iPad (TARGETED_DEVICE_FAMILY 1,2). App Store
    // Connect rejects an update that drops a device family, so keep it.
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: APP_ID,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './config/google-services.json',
    versionCode: Number(buildNumber),
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#FFFFFF',
    },
    // Google Maps renders the food map and the YouBike station picker on
    // Android. Without a key the map stays blank (iOS uses Apple Maps and
    // needs nothing). Create one for "Maps SDK for Android" in Google Cloud.
    config: process.env.GOOGLE_MAPS_API_KEY
      ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } }
      : undefined,
  },
  plugins: [
    'expo-router',
    './plugins/with-android-debug-identity',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
      },
    ],
    'expo-sqlite',
    ['expo-notifications', { defaultChannel: 'announcements', mode: iosPushEnvironment, enableBackgroundRemoteNotifications: false }],
    // SDK 57 opts into scenes so builds made with Xcode 27 launch on iOS 27.
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
        ios: { enableSceneSupport: true },
      },
    ],
    ...(widgets
      ? [
          [
            'expo-widgets',
            {
              bundleIdentifier: `${APP_ID}.ExpoWidgetsTarget`,
              groupIdentifier: `group.${APP_ID}`,
              widgets: [
                {
                  name: 'NowWidget',
                  displayName: '現在',
                  description: '現在這一節、下課倒數和接下來的課。',
                  ios: {
                    supportedFamilies: ['systemSmall', 'systemMedium', 'accessoryRectangular', 'accessoryInline'],
                    contentMarginsDisabled: false,
                  },
                },
              ],
            },
          ] as [string, unknown],
        ]
      : []),
  ],
  extra: {
    // Firebase web configuration identifies the project; authorization is
    // enforced by Firestore rules in CKApp-Dev/Notification, never by hiding these values.
    firebase: {
      ...firebaseConfig,
      apiKey: process.env.FIREBASE_API_KEY || firebaseConfig.apiKey,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
      projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
      appId: process.env.FIREBASE_APP_ID || firebaseConfig.appId,
    },
    eas: { projectId: process.env.EAS_PROJECT_ID || expoProject.projectId },
    googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    // Taipei Metro (api.metro.taipei) account for the 交通 page. A client-only
    // app ships whatever value is configured, exactly as the Quasar build did;
    // see docs/refactoring-plan.md (Phase 1-B) for why this is accepted.
    metroApi: {
      user: process.env.METRO_API_USER ?? '',
      pass: process.env.METRO_API_PASS ?? '',
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
