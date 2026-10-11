import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { plan, validateExpoTarget, validateGoogleKey } from './configure-android-push.mjs';

const app = () => ({ id: '8961c130-925c-4100-b7a9-67d0e4bf6868', slug: 'ck-app', fullName: '@ckappofficial/ck-app',
  ownerAccount: { id: 'approved-account', name: 'ckappofficial' }, androidAppCredentials: [] });
const target = () => ({ meActor: { username: 'ckappofficial', accounts: [{ id: 'approved-account', name: 'ckappofficial' }] }, app: { byId: app() } });

test('credential upload refuses an unexpected Expo login, project, or owner', () => {
  assert.equal(validateExpoTarget(target()).slug, 'ck-app');
  for (const change of [
    (data) => { data.meActor.username = 'different-user'; },
    (data) => { data.app.byId.id = 'different-project'; },
    (data) => { data.app.byId.ownerAccount.name = 'different-owner'; },
    (data) => { data.meActor.accounts = []; },
  ]) {
    const data = target(); change(data);
    assert.throws(() => validateExpoTarget(data), /does not match/);
  }
});

test('credential upload refuses replacement of unrelated existing FCM credentials', () => {
  const data = target();
  data.app.byId.androidAppCredentials.push({ applicationIdentifier: 'org.capacitor.quasar.ckapp', googleServiceAccountKeyForFcmV1: {
    id: 'other', clientEmail: 'other@ck-app-database.iam.gserviceaccount.com', projectIdentifier: 'ck-app-database',
  } });
  assert.throws(() => validateExpoTarget(data), /replacement requires separate review/);
});

test('invalid Google key errors never disclose private-key material', () => {
  const marker = 'PRIVATE-CREDENTIAL-MUST-NOT-APPEAR';
  assert.throws(() => validateGoogleKey({ private_key: marker }, 'unexpected'), (error) => {
    assert.equal(error.message.includes(marker), false);
    return /identity does not match/.test(error.message);
  });
});

test('default plan needs no credentials; apply is blocked before network without the approval flag', () => {
  assert.equal(plan().projectRole, 'roles/firebasecloudmessaging.admin');
  const script = fileURLToPath(new URL('./configure-android-push.mjs', import.meta.url));
  const marker = 'BEARER-CREDENTIAL-MUST-NOT-APPEAR';
  const dry = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, EXPO_TOKEN: marker } });
  assert.equal(dry.status, 0);
  assert.equal(JSON.parse(dry.stdout).mode, 'dry-run; no network or writes');
  const blocked = spawnSync(process.execPath, [script, '--apply'], { encoding: 'utf8', input: marker, env: { ...process.env, EXPO_TOKEN: marker } });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /requires explicit approval/);
  assert.equal(`${dry.stdout}${dry.stderr}${blocked.stdout}${blocked.stderr}`.includes(marker), false);
});
