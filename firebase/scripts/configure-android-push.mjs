#!/usr/bin/env node
// REVIEW FIRST. Default is a local plan with no network requests.
// --check-expo performs read-only target/credential-metadata checks.
// --apply --approve-key-creation-and-expo-upload is for an explicitly approved
// operation only. Google OAuth bearer token is accepted solely via piped stdin.
// The generated Google private key remains in memory and is sent only to Expo's
// fixed HTTPS endpoint for the fixed account/project. No credential files/logs.
// EAS GraphQL operations mirror the installed eas-cli credential mutations.
import { createRequire } from 'node:module';
import { createPrivateKey } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const PROJECT_ID = 'ck-app-database';
const PROJECT_NUMBER = '253500838094';
const ACCOUNT_ID = 'ck-app-push';
const SERVICE_ACCOUNT = `${ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com`;
const MESSAGING_ROLE = 'roles/firebasecloudmessaging.admin';
const EXPO_OWNER = 'ckappofficial';
const EXPO_SLUG = 'ck-app';
const EXPO_APP_ID = '8961c130-925c-4100-b7a9-67d0e4bf6868';
const EXPO_FULL_NAME = `@${EXPO_OWNER}/${EXPO_SLUG}`;
const PACKAGES = ['org.capacitor.quasar.ckapp', 'org.capacitor.quasar.ckapp.dev'];
const EXPO_URL = 'https://api.expo.dev/graphql';
const IAM = 'https://iam.googleapis.com/v1/';
const RESOURCE = 'https://cloudresourcemanager.googleapis.com/v1/';
const SERVICE_USAGE = 'https://serviceusage.googleapis.com/v1/';
const CREDENTIAL_FIELDS = 'id applicationIdentifier googleServiceAccountKeyForFcmV1 { id clientEmail projectIdentifier privateKeyIdentifier }';
const KEY_FIELDS = 'id clientEmail projectIdentifier privateKeyIdentifier';

class SetupError extends Error {}
class ApiError extends SetupError {
  constructor(label, status) { super(`${label} failed (HTTP ${status}). No response or credential details were logged.`); this.status = status; }
}

export function plan() {
  return {
    mode: 'dry-run; no network or writes',
    firebaseProject: PROJECT_ID, firebaseProjectNumber: PROJECT_NUMBER,
    dedicatedServiceAccount: SERVICE_ACCOUNT, projectRole: MESSAGING_ROLE,
    expoOwner: EXPO_OWNER, expoProject: EXPO_FULL_NAME, expoProjectId: EXPO_APP_ID,
    androidIdentifiers: PACKAGES,
    operations: ['verify Expo login/account/project', 'verify Firebase project and messaging role',
      'enable FCM API if required', 'create dedicated service account if absent',
      'grant only the messaging role to the dedicated account',
      'reuse matching uploaded key or create one approved RSA Google key in memory',
      'upload new key to the verified Expo owner account', 'associate FCM v1 for both Android identifiers',
      'verify associations through metadata-only queries'],
    approval: '--apply requires --approve-key-creation-and-expo-upload after explicit user approval',
    credentials: 'Google bearer token through non-TTY stdin; Expo existing local session; private key in memory only',
    replacement: 'refuse existing foreign FCM credentials or ambiguous key state; do not replace/revoke automatically',
  };
}

export function validateExpoTarget(data) {
  const actor = data?.meActor;
  const app = data?.app?.byId;
  if (actor?.username !== EXPO_OWNER || app?.id !== EXPO_APP_ID || app?.slug !== EXPO_SLUG
    || app?.fullName !== EXPO_FULL_NAME || app?.ownerAccount?.name !== EXPO_OWNER
    || !actor.accounts?.some((account) => account.id === app.ownerAccount.id && account.name === EXPO_OWNER)) {
    throw new SetupError('Expo identity/project does not match the approved ckappofficial/ck-app target.');
  }
  for (const applicationIdentifier of PACKAGES) {
    const rows = (app.androidAppCredentials ?? []).filter((row) => row.applicationIdentifier === applicationIdentifier);
    if (rows.length > 1) throw new SetupError('Ambiguous Android credential records; review in Expo before proceeding.');
    const key = rows[0]?.googleServiceAccountKeyForFcmV1;
    if (key && (key.clientEmail !== SERVICE_ACCOUNT || key.projectIdentifier !== PROJECT_ID)) {
      throw new SetupError('An Android identifier already has a different FCM key; replacement requires separate review.');
    }
  }
  return app;
}

export function validateGoogleKey(key, keyName) {
  if (key?.type !== 'service_account' || key.project_id !== PROJECT_ID || key.client_email !== SERVICE_ACCOUNT
    || key.private_key_id !== keyName?.split('/').at(-1) || typeof key.private_key !== 'string'
    || key.token_uri !== 'https://oauth2.googleapis.com/token') {
    throw new SetupError('Generated key identity does not match the approved messaging service account.');
  }
  try {
    if (createPrivateKey(key.private_key).asymmetricKeyType !== 'rsa') throw new Error();
  } catch { throw new SetupError('Generated key is not a valid RSA private key.'); }
}

function expoRequest(easRoot) {
  const require = createRequire(resolve(easRoot, 'package.json'));
  const SessionManager = require('./build/user/SessionManager.js').default;
  const session = new SessionManager();
  const accessToken = session.getAccessToken();
  const sessionSecret = accessToken ? null : session.getSessionSecret();
  if (!accessToken && !sessionSecret) throw new SetupError('EAS is not logged in; use eas login first.');
  const headers = { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { 'expo-session': sessionSecret }) };
  return async (query, variables, label) => {
    let response;
    try {
      response = await fetch(EXPO_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers,
        body: JSON.stringify({ query, variables }) });
    } catch { throw new SetupError(`${label} could not complete; no request/credential details were logged.`); }
    if (!response.ok) throw new ApiError(label, response.status);
    let result;
    try { result = await response.json(); } catch { throw new SetupError(`${label} returned invalid JSON.`); }
    if (result.errors?.length || !result.data) throw new SetupError(`${label} was rejected by Expo; no response details were logged.`);
    return result.data;
  };
}

async function inspectExpo(request) {
  const result = await request(`query PushCredentialPreflight($appId: String!) {
    meActor { ... on UserActor { username } accounts { id name } }
    app { byId(appId: $appId) { id slug fullName ownerAccount { id name }
      androidAppCredentials(filter: { legacyOnly: false }) { ${CREDENTIAL_FIELDS} }
    } }
  }`, { appId: EXPO_APP_ID }, 'Expo target verification');
  return validateExpoTarget(result);
}

async function accountKeys(request) {
  const keys = [];
  let after = null;
  do {
    const result = await request(`query PushAccountKeys($accountName: String!, $after: String) {
      account { byName(accountName: $accountName) { id name googleServiceAccountKeysPaginated(first: 100, after: $after) {
        edges { node { ${KEY_FIELDS} } } pageInfo { hasNextPage endCursor }
      } } }
    }`, { accountName: EXPO_OWNER, after }, 'Expo key metadata lookup');
    if (result.account?.byName?.name !== EXPO_OWNER) throw new SetupError('Expo credential account mismatch.');
    const page = result.account.byName.googleServiceAccountKeysPaginated;
    keys.push(...page.edges.map((edge) => edge.node));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (page.pageInfo.hasNextPage && !after) throw new SetupError('Expo key pagination did not return a cursor.');
  } while (after);
  return keys;
}

async function bearerFromStdin() {
  if (process.stdin.isTTY) throw new SetupError('Pipe the Google OAuth bearer token through non-terminal stdin; terminal input is refused.');
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 16384) throw new SetupError('Credential input is too large.');
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const token = buffer.toString('utf8').trim();
  buffer.fill(0); chunks.forEach((chunk) => chunk.fill(0));
  if (!/^[A-Za-z0-9._~+/-]+=*$/.test(token)) throw new SetupError('Expected one opaque OAuth bearer token through stdin.');
  return token;
}

function googleRequest(token) {
  return async (base, path, method = 'GET', body) => {
    let response;
    try {
      response = await fetch(`${base}${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch { throw new SetupError(`Google ${method} request could not complete; no credential details were logged.`); }
    if (!response.ok) throw new ApiError(`Google ${method}`, response.status);
    if (response.status === 204) return {};
    try { return await response.json(); } catch { throw new SetupError('Google returned invalid JSON; no response details were logged.'); }
  };
}

async function optional(get) {
  try { return await get(); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}

async function enableFcm(request) {
  const path = `projects/${PROJECT_NUMBER}/services/fcm.googleapis.com`;
  if ((await request(SERVICE_USAGE, path)).state === 'ENABLED') return;
  let operation = await request(SERVICE_USAGE, `${path}:enable`, 'POST');
  const deadline = Date.now() + 120000;
  while (!operation.done) {
    if (Date.now() > deadline || !/^operations\/[A-Za-z0-9_/-]+$/.test(operation.name ?? '')) {
      throw new SetupError('FCM API enablement needs manual inspection before retry.');
    }
    await delay(2000);
    operation = await request(SERVICE_USAGE, operation.name);
  }
  if (operation.error) throw new SetupError('FCM API enablement failed; no response details were logged.');
}

async function ensureMessagingRole(request) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const policy = await request(RESOURCE, `projects/${PROJECT_ID}:getIamPolicy`, 'POST', { options: { requestedPolicyVersion: 3 } });
    if (!policy.etag) throw new SetupError('Project IAM policy has no etag; refusing an unguarded change.');
    const member = `serviceAccount:${SERVICE_ACCOUNT}`;
    if ((policy.bindings ?? []).some((binding) => binding.role !== MESSAGING_ROLE && binding.members?.includes(member))) {
      throw new SetupError('The dedicated messaging account already has another project role; review excess privileges first.');
    }
    const next = structuredClone(policy);
    next.bindings ??= [];
    const binding = next.bindings.find((entry) => entry.role === MESSAGING_ROLE && !entry.condition);
    if (binding?.members?.includes(member)) return;
    if (binding) binding.members.push(member); else next.bindings.push({ role: MESSAGING_ROLE, members: [member] });
    try {
      await request(RESOURCE, `projects/${PROJECT_ID}:setIamPolicy`, 'POST', { policy: next, updateMask: 'bindings,etag' });
      return;
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 409 || error.status === 412)) || attempt === 4) throw error;
    }
  }
}

async function associate(request, app, googleKey) {
  for (const applicationIdentifier of PACKAGES) {
    let credentials = app.androidAppCredentials.find((row) => row.applicationIdentifier === applicationIdentifier);
    if (!credentials) {
      const result = await request(`mutation CreatePushAndroidCredentials($input: AndroidAppCredentialsInput!, $appId: ID!, $applicationIdentifier: String!) {
        androidAppCredentials { createAndroidAppCredentials(androidAppCredentialsInput: $input, appId: $appId, applicationIdentifier: $applicationIdentifier) { ${CREDENTIAL_FIELDS} } }
      }`, { input: {}, appId: EXPO_APP_ID, applicationIdentifier }, 'Expo Android identifier setup');
      credentials = result.androidAppCredentials.createAndroidAppCredentials;
      if (credentials.applicationIdentifier !== applicationIdentifier) throw new SetupError('Expo returned an unexpected Android identifier.');
    }
    const current = credentials.googleServiceAccountKeyForFcmV1;
    if (current?.id === googleKey.id) continue;
    if (current) throw new SetupError('FCM credentials changed during setup; refusing replacement.');
    const result = await request(`mutation AssignPushKey($androidAppCredentialsId: ID!, $googleServiceAccountKeyId: ID!) {
      androidAppCredentials { setGoogleServiceAccountKeyForFcmV1(id: $androidAppCredentialsId, googleServiceAccountKeyId: $googleServiceAccountKeyId) { ${CREDENTIAL_FIELDS} } }
    }`, { androidAppCredentialsId: credentials.id, googleServiceAccountKeyId: googleKey.id }, 'Expo FCM v1 association');
    const updated = result.androidAppCredentials.setGoogleServiceAccountKeyForFcmV1;
    if (updated.applicationIdentifier !== applicationIdentifier || updated.googleServiceAccountKeyForFcmV1?.id !== googleKey.id) {
      throw new SetupError('Expo did not confirm the intended FCM v1 association.');
    }
  }
}

async function apply(easRoot) {
  const expo = expoRequest(easRoot);
  let app = await inspectExpo(expo); // Verify destination before reading Google credential input.
  const keys = await accountKeys(expo);
  const google = googleRequest(await bearerFromStdin());
  const project = await google(RESOURCE, `projects/${PROJECT_ID}`);
  if (project.projectId !== PROJECT_ID || String(project.projectNumber) !== PROJECT_NUMBER || project.lifecycleState !== 'ACTIVE') {
    throw new SetupError('Firebase project identity/state does not match the approved target.');
  }
  const role = await google(IAM, MESSAGING_ROLE);
  if (role.name !== MESSAGING_ROLE || !role.includedPermissions?.includes('cloudmessaging.messages.create')) {
    throw new SetupError('The current Google messaging role does not contain the required send permission.');
  }
  await enableFcm(google);
  const accountPath = `projects/${PROJECT_ID}/serviceAccounts/${encodeURIComponent(SERVICE_ACCOUNT)}`;
  let account = await optional(() => google(IAM, accountPath));
  if (!account) account = await google(IAM, `projects/${PROJECT_ID}/serviceAccounts`, 'POST', {
    accountId: ACCOUNT_ID, serviceAccount: { displayName: 'CK App Expo Android push', description: 'Dedicated FCM v1 sending identity for @ckappofficial/ck-app only.' },
  });
  if (account.email !== SERVICE_ACCOUNT || account.projectId !== PROJECT_ID || account.disabled) throw new SetupError('Messaging service account identity/state mismatch.');
  await ensureMessagingRole(google);
  const keyPath = `${accountPath}/keys`;
  const activeKeys = (await google(IAM, `${keyPath}?keyTypes=USER_MANAGED`)).keys?.filter((key) => !key.disabled
    && (!key.validBeforeTime || Date.parse(key.validBeforeTime) > Date.now())) ?? [];
  const candidates = keys.filter((key) => key.clientEmail === SERVICE_ACCOUNT && key.projectIdentifier === PROJECT_ID
    && activeKeys.some((active) => active.name.split('/').at(-1) === key.privateKeyIdentifier));
  if (candidates.length > 1) throw new SetupError('Multiple active messaging keys exist in Expo; review before proceeding.');
  let googleKey = candidates[0];
  if (!googleKey) {
    if (activeKeys.length) throw new SetupError('An unassociated active Google key exists; review/revoke it before authorizing another key.');
    // Key creation is deliberately not retried: an ambiguous response needs review.
    const response = await google(IAM, keyPath, 'POST', { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE', keyAlgorithm: 'KEY_ALG_RSA_2048' });
    let decoded;
    let jsonKey;
    try {
      decoded = Buffer.from(response.privateKeyData, 'base64');
      response.privateKeyData = '';
      jsonKey = JSON.parse(decoded.toString('utf8'));
      validateGoogleKey(jsonKey, response.name);
      const result = await expo(`mutation UploadPushKey($input: GoogleServiceAccountKeyInput!, $accountId: ID!) {
        googleServiceAccountKey { createGoogleServiceAccountKey(googleServiceAccountKeyInput: $input, accountId: $accountId) { ${KEY_FIELDS} } }
      }`, { input: { jsonKey }, accountId: app.ownerAccount.id }, 'Expo in-memory FCM key upload');
      googleKey = result.googleServiceAccountKey.createGoogleServiceAccountKey;
      if (googleKey.clientEmail !== SERVICE_ACCOUNT || googleKey.projectIdentifier !== PROJECT_ID || googleKey.privateKeyIdentifier !== jsonKey.private_key_id) {
        throw new SetupError('Expo uploaded-key identity verification failed; inspect dedicated-account metadata before retry.');
      }
    } catch {
      // Do not revoke automatically: upload/association state can be ambiguous.
      throw new SetupError('Key creation/upload needs review. A dedicated Google key may exist; inspect Google and Expo metadata before retrying. No credential material was stored or printed.');
    } finally {
      if (decoded) decoded.fill(0);
      if (jsonKey) jsonKey.private_key = '';
      response.privateKeyData = '';
    }
  }
  app = await inspectExpo(expo);
  await associate(expo, app, googleKey);
  const confirmed = await inspectExpo(expo);
  if (!PACKAGES.every((identifier) => confirmed.androidAppCredentials.some((row) => row.applicationIdentifier === identifier && row.googleServiceAccountKeyForFcmV1?.id === googleKey.id))) {
    throw new SetupError('Both Android associations were not confirmed; inspect Expo before retry.');
  }
  console.log('FCM v1 credential associations verified for both approved Android identifiers. No credential material was stored or printed.');
}

async function main() {
  const args = process.argv.slice(2);
  let easRoot;
  let applyRequested = false;
  let approved = false;
  let checkExpo = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--eas-cli-root' && !easRoot) easRoot = args[++i];
    else if (args[i] === '--apply' && !applyRequested) applyRequested = true;
    else if (args[i] === '--approve-key-creation-and-expo-upload' && !approved) approved = true;
    else if (args[i] === '--check-expo' && !checkExpo) checkExpo = true;
    else throw new SetupError('Unknown/repeated option; use --eas-cli-root PATH, --check-expo, or approved --apply.');
  }
  if (applyRequested && (!approved || checkExpo)) throw new SetupError('--apply requires explicit approval flag and cannot be combined with --check-expo.');
  if (approved && !applyRequested) throw new SetupError('Approval flag is valid only with --apply.');
  if (!applyRequested && !checkExpo) { console.log(JSON.stringify(plan(), null, 2)); return; }
  if (!easRoot) throw new SetupError('--eas-cli-root must point to the installed eas-cli package directory.');
  if (checkExpo) {
    const request = expoRequest(easRoot);
    const app = await inspectExpo(request);
    const keys = await accountKeys(request);
    console.log(JSON.stringify({ mode: 'read-only Expo check', verifiedProject: EXPO_FULL_NAME,
      matchingUploadedKeyCount: keys.filter((key) => key.clientEmail === SERVICE_ACCOUNT && key.projectIdentifier === PROJECT_ID).length,
      identifiers: PACKAGES.map((identifier) => ({ identifier, registered: app.androidAppCredentials.some((row) => row.applicationIdentifier === identifier),
        fcmConfigured: app.androidAppCredentials.some((row) => row.applicationIdentifier === identifier && !!row.googleServiceAccountKeyForFcmV1) })) }, null, 2));
    return;
  }
  await apply(easRoot);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error instanceof SetupError ? error.message : 'Android push setup failed; no credential details were logged.'); process.exitCode = 1; });
}
