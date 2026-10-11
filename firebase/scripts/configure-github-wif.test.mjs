import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, verifyDedicatedPool, verifyProject, withBinding } from './configure-github-wif.mjs';

test('trust pins numeric repository/owner identities, main, exact workflow and approved event types', () => {
  const config = configuration('12345678');
  const condition = config.providerConfig.attributeCondition;
  for (const claim of [
    "assertion.repository_id == '1413830142'",
    "assertion.repository_owner_id == '12345678'",
    "assertion.ref == 'refs/heads/main'",
    "assertion.workflow_ref == 'ChrisSun0731/CK-App-Admin/.github/workflows/announcements.yml@refs/heads/main'",
    "assertion.event_name in ['schedule', 'workflow_dispatch']",
  ]) assert.ok(condition.includes(claim));
  assert.equal(config.providerConfig.oidc.issuerUri, 'https://token.actions.githubusercontent.com');
  assert.deepEqual(config.providerConfig.oidc.allowedAudiences, []);
  assert.equal(config.principal, 'principalSet://iam.googleapis.com/projects/253500838094/locations/global/workloadIdentityPools/github-announcements/attribute.repository_id/1413830142');
});

test('owner ID cannot inject CEL or replace the fixed project identity', () => {
  for (const owner of [undefined, '', '0', '-1', "1' || true", '123 456', '1e10']) assert.throws(() => configuration(owner));
  verifyProject({ projectId: 'ck-app-database', projectNumber: '253500838094', lifecycleState: 'ACTIVE' });
  assert.throws(() => verifyProject({ projectId: 'other-project', projectNumber: '253500838094', lifecycleState: 'ACTIVE' }));
  assert.throws(() => verifyProject({ projectId: 'ck-app-database', projectNumber: '999', lifecycleState: 'ACTIVE' }));
});

test('policy additions preserve unrelated/conditional grants, audit configuration and etag', () => {
  const policy = {
    version: 3, etag: 'original-etag', auditConfigs: [{ service: 'allServices' }],
    bindings: [
      { role: 'roles/owner', members: ['user:existing@example.com'] },
      { role: 'roles/datastore.user', members: ['serviceAccount:conditional@example.com'], condition: { expression: 'false', title: 'restricted' } },
    ],
  };
  const added = withBinding(policy, 'roles/datastore.user', 'serviceAccount:worker@example.com');
  assert.deepEqual(added.bindings.slice(0, 2), policy.bindings);
  assert.deepEqual(added.auditConfigs, policy.auditConfigs);
  assert.equal(added.etag, policy.etag);
  assert.equal(added.version, 3);
  assert.equal(policy.bindings.length, 2);
  assert.equal(withBinding(added, 'roles/datastore.user', 'serviceAccount:worker@example.com'), null);
  assert.throws(() => withBinding({ bindings: [] }, 'roles/datastore.user', 'member'));
});

test('a shared pool cannot bypass the provider trust through the pool-wide principalSet', () => {
  const provider = configuration('123').provider;
  verifyDedicatedPool([{ name: provider, state: 'ACTIVE' }], provider);
  verifyDedicatedPool([{ name: `${provider}-old`, state: 'DELETED' }], provider);
  assert.throws(() => verifyDedicatedPool([{ name: `${provider}-other`, state: 'ACTIVE' }], provider));
});
