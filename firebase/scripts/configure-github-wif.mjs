#!/usr/bin/env node
// Dry-run by default. --apply accepts one OAuth bearer token through piped stdin
// only; credentials are never accepted in argv, environment variables, or files.
// REST contracts: https://docs.cloud.google.com/iam/docs/reference/rest/v1
// https://docs.cloud.google.com/service-usage/docs/reference/rest/v1
// https://docs.cloud.google.com/resource-manager/reference/rest/v1/projects
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PROJECT_ID = 'ck-app-database';
const PROJECT_NUMBER = '253500838094';
const REPOSITORY = 'ChrisSun0731/CK-App-Admin';
const REPOSITORY_ID = '1413830142';
const POOL_ID = 'github-announcements';
const PROVIDER_ID = 'github-actions';
const ACCOUNT_ID = 'ck-announcements';
const IAM = 'https://iam.googleapis.com/v1/';
const RESOURCE_MANAGER = 'https://cloudresourcemanager.googleapis.com/v1/';
const SERVICE_USAGE = 'https://serviceusage.googleapis.com/v1/';
const SERVICES = ['iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com'];

class ConfigurationError extends Error {}
class ApiError extends ConfigurationError {
  constructor(method, path, status, googleStatus) {
    // Google error messages/bodies are deliberately never printed: they can
    // contain arbitrary request details. Only status codes and fixed paths.
    super(`${method} ${path.split('?')[0]} failed (HTTP ${status}${googleStatus ? `, ${googleStatus}` : ''}).`);
    this.status = status;
  }
}

export function configuration(ownerId) {
  if (typeof ownerId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(ownerId)) {
    throw new ConfigurationError('--owner-id must be the numeric GitHub repository owner ID.');
  }
  const pool = `projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}`;
  const provider = `${pool}/providers/${PROVIDER_ID}`;
  const serviceAccount = `${ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com`;
  const attributeCondition = [
    `assertion.repository_id == '${REPOSITORY_ID}'`,
    `assertion.repository_owner_id == '${ownerId}'`,
    "assertion.ref == 'refs/heads/main'",
    `assertion.workflow_ref == '${REPOSITORY}/.github/workflows/announcements.yml@refs/heads/main'`,
    "assertion.event_name in ['schedule', 'workflow_dispatch']",
  ].join(' && ');
  return {
    projectId: PROJECT_ID, projectNumber: PROJECT_NUMBER,
    repository: REPOSITORY, repositoryId: REPOSITORY_ID, ownerId,
    pool, provider, serviceAccount,
    principal: `principalSet://iam.googleapis.com/${pool}/attribute.repository_id/${REPOSITORY_ID}`,
    providerConfig: {
      displayName: 'CK announcements GitHub Actions',
      description: 'Only the approved CK-App-Admin main-branch announcement workflow.',
      attributeMapping: {
        'google.subject': 'assertion.sub',
        'attribute.repository_id': 'assertion.repository_id',
        'attribute.repository_owner_id': 'assertion.repository_owner_id',
        'attribute.ref': 'assertion.ref',
        'attribute.workflow_ref': 'assertion.workflow_ref',
        'attribute.event_name': 'assertion.event_name',
      },
      attributeCondition,
      // Empty audiences require the canonical provider audience, which the
      // google-github-actions/auth action uses by default.
      oidc: { issuerUri: 'https://token.actions.githubusercontent.com', allowedAudiences: [] },
    },
  };
}

export function verifyProject(project) {
  if (project.projectId !== PROJECT_ID || String(project.projectNumber) !== PROJECT_NUMBER || project.lifecycleState !== 'ACTIVE') {
    throw new ConfigurationError('Project identity/state does not match the approved active ck-app-database project.');
  }
}

export function verifyDedicatedPool(providers, expectedProvider) {
  if (providers.some((provider) => provider.name !== expectedProvider && provider.state !== 'DELETED' && !provider.disabled)) {
    throw new ConfigurationError('The dedicated workload pool contains another active provider; refusing a shared-pool principal grant.');
  }
}

/** Preserve conditional bindings, audit configuration, version and etag. */
export function withBinding(policy, role, member) {
  if (typeof policy.etag !== 'string' || !policy.etag) throw new ConfigurationError('IAM policy has no etag; refusing an unguarded update.');
  const next = structuredClone(policy);
  next.bindings ??= [];
  const binding = next.bindings.find((entry) => entry.role === role && !entry.condition);
  if (binding?.members?.includes(member)) return null;
  if (binding) binding.members = [...(binding.members ?? []), member];
  else next.bindings.push({ role, members: [member] });
  return next;
}

function sameProvider(actual, expected) {
  return actual.attributeCondition === expected.attributeCondition
    && actual.oidc?.issuerUri === expected.oidc.issuerUri
    && (actual.oidc?.allowedAudiences?.length ?? 0) === 0
    && !actual.oidc?.jwksJson
    && JSON.stringify(Object.entries(actual.attributeMapping ?? {}).sort()) === JSON.stringify(Object.entries(expected.attributeMapping).sort());
}

function activeResource(resource, expectedName, kind) {
  if (resource.name !== expectedName || resource.state !== 'ACTIVE' || resource.disabled) {
    throw new ConfigurationError(`Existing ${kind} has an unexpected identity or is disabled/deleted; manual review is required.`);
  }
}

async function bearerFromStdin() {
  if (process.stdin.isTTY) throw new ConfigurationError('--apply requires the bearer token through non-terminal stdin; terminal entry is refused to prevent echo.');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 16_384) throw new ConfigurationError('Credential input is too large.');
    chunks.push(chunk);
  }
  const token = Buffer.concat(chunks).toString('utf8').trim();
  if (!/^[A-Za-z0-9._~+/-]+=*$/.test(token)) throw new ConfigurationError('Expected one opaque OAuth bearer token on stdin.');
  return token;
}

function googleClient(token) {
  return async (base, path, method = 'GET', body) => {
    let response;
    try {
      response = await fetch(`${base}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ConfigurationError(`${method} ${path.split('?')[0]} could not complete within the network deadline.`);
    }
    let data;
    try { data = await response.json(); }
    catch { throw new ConfigurationError(`${method} ${path.split('?')[0]} returned an invalid JSON response (HTTP ${response.status}).`); }
    if (!response.ok) {
      const status = typeof data?.error?.status === 'string' && /^[A-Z_]{1,64}$/.test(data.error.status) ? data.error.status : '';
      throw new ApiError(method, path, response.status, status);
    }
    return data;
  };
}

async function optional(get) {
  try { return await get(); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}

async function waitForOperation(request, base, initial, config) {
  let operation = initial;
  const deadline = Date.now() + 180_000;
  while (!operation.done) {
    if (Date.now() >= deadline) throw new ConfigurationError('Google operation is still pending after three minutes; rerun safely to inspect existing resources.');
    const prefix = base === SERVICE_USAGE ? 'operations/' : `${config.pool}/`;
    // Never follow a response-supplied URL or an operation outside this pool.
    if (typeof operation.name !== 'string' || !operation.name.startsWith(prefix)
      || !/^[A-Za-z0-9_./-]+$/.test(operation.name) || operation.name.includes('..')) {
      throw new ConfigurationError('Google returned an unexpected operation resource name.');
    }
    await delay(2_000);
    operation = await request(base, operation.name);
  }
  if (operation.error) {
    const code = Number.isInteger(operation.error.code) ? operation.error.code : 'unknown';
    throw new ConfigurationError(`Google operation failed (code ${code}); no error-body details were logged.`);
  }
  return operation.response;
}

async function createIfMissing(get, create) {
  let resource = await optional(get);
  if (resource) return resource;
  try { await create(); }
  catch (error) { if (!(error instanceof ApiError && error.status === 409)) throw error; }
  // Resource creation and IAM visibility can be eventually consistent.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    resource = await optional(get);
    if (resource) return resource;
    await delay(1_000);
  }
  throw new ConfigurationError('Created resource is not yet visible; rerun safely after propagation.');
}

async function listProviders(request, config) {
  const providers = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await request(IAM, `${config.pool}/providers?${query}`);
    providers.push(...(page.workloadIdentityPoolProviders ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return providers;
}

async function ensureBinding(request, base, resource, role, member, serviceAccount = false) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const policy = await request(base,
      `${resource}:getIamPolicy${serviceAccount ? '?options.requestedPolicyVersion=3' : ''}`,
      'POST', serviceAccount ? undefined : { options: { requestedPolicyVersion: 3 } });
    const next = withBinding(policy, role, member);
    if (!next) return;
    try {
      await request(base, `${resource}:setIamPolicy`, 'POST', { policy: next, updateMask: 'bindings,etag' });
      return;
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 409 || error.status === 412)) || attempt === 4) throw error;
      await delay(1_000);
    }
  }
}

async function provision(config, token) {
  const request = googleClient(token);
  verifyProject(await request(RESOURCE_MANAGER, `projects/${PROJECT_ID}`));
  for (const service of SERVICES) {
    const path = `projects/${PROJECT_NUMBER}/services/${service}`;
    const current = await request(SERVICE_USAGE, path);
    if (current.state !== 'ENABLED') {
      console.log(`Enable API: ${service}`);
      await waitForOperation(request, SERVICE_USAGE, await request(SERVICE_USAGE, `${path}:enable`, 'POST'), config);
    }
  }
  const accountPath = `projects/${PROJECT_ID}/serviceAccounts/${encodeURIComponent(config.serviceAccount)}`;
  const account = await createIfMissing(
    () => request(IAM, accountPath),
    () => request(IAM, `projects/${PROJECT_ID}/serviceAccounts`, 'POST', {
      accountId: ACCOUNT_ID,
      serviceAccount: { displayName: 'CK announcements worker', description: 'Firestore access for the approved GitHub announcement workflow only.' },
    }),
  );
  if (account.projectId !== PROJECT_ID || account.email !== config.serviceAccount || account.disabled) {
    throw new ConfigurationError('Service account identity/state does not match the approved enabled worker account.');
  }
  const pool = await createIfMissing(
    () => request(IAM, config.pool),
    async () => waitForOperation(request, IAM, await request(IAM,
      `projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools?workloadIdentityPoolId=${POOL_ID}`,
      'POST', { displayName: 'CK announcements GitHub', description: 'Dedicated to the CK-App-Admin announcement workflow.' }), config),
  );
  activeResource(pool, config.pool, 'workload pool');
  verifyDedicatedPool(await listProviders(request, config), config.provider);
  let provider = await createIfMissing(
    () => request(IAM, config.provider),
    async () => waitForOperation(request, IAM, await request(IAM,
      `${config.pool}/providers?workloadIdentityPoolProviderId=${PROVIDER_ID}`, 'POST', config.providerConfig), config),
  );
  activeResource(provider, config.provider, 'OIDC provider');
  if (!provider.oidc || provider.oidc.issuerUri !== config.providerConfig.oidc.issuerUri) {
    throw new ConfigurationError('Existing provider does not use the approved GitHub OIDC issuer; refusing to repurpose it.');
  }
  if (!sameProvider(provider, config.providerConfig)) {
    console.log('Apply the exact repository, owner, main branch, workflow and event trust condition.');
    await waitForOperation(request, IAM, await request(IAM,
      `${config.provider}?updateMask=attributeMapping,attributeCondition,oidc`, 'PATCH', config.providerConfig), config);
    provider = await request(IAM, config.provider);
  }
  activeResource(provider, config.provider, 'OIDC provider');
  if (!sameProvider(provider, config.providerConfig)) throw new ConfigurationError('Provider trust verification failed; no IAM roles were granted.');
  verifyDedicatedPool(await listProviders(request, config), config.provider);
  // Apply privileges only after the exact dedicated trust boundary is verified.
  await ensureBinding(request, RESOURCE_MANAGER, `projects/${PROJECT_ID}`, 'roles/datastore.user', `serviceAccount:${config.serviceAccount}`);
  await ensureBinding(request, IAM, accountPath, 'roles/iam.workloadIdentityUser', config.principal, true);
}

function printPlan(config, apply) {
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run (no network requests or changes)',
    projectId: config.projectId, projectNumber: config.projectNumber,
    enableApisIfDisabled: SERVICES,
    serviceAccount: config.serviceAccount,
    workloadPool: config.pool,
    workloadIdentityProvider: config.provider,
    oidcIssuer: config.providerConfig.oidc.issuerUri,
    attributeMapping: config.providerConfig.attributeMapping,
    attributeCondition: config.providerConfig.attributeCondition,
    projectBinding: { role: 'roles/datastore.user', member: `serviceAccount:${config.serviceAccount}` },
    serviceAccountBinding: { role: 'roles/iam.workloadIdentityUser', member: config.principal },
    policyUpdates: 'Preserve all existing bindings, conditions, audit configuration and etags; retry conflicts.',
    existingResources: 'Verify enabled identities; enforce exact provider trust; refuse another active provider in the dedicated pool.',
  }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node firebase/scripts/configure-github-wif.mjs --owner-id GITHUB_NUMERIC_OWNER_ID [--apply]');
    console.log('Default prints a plan without credentials/network. --apply reads one bearer token exclusively from non-terminal stdin.');
    return;
  }
  let ownerId;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--owner-id' && ownerId === undefined) ownerId = args[++index];
    else if (args[index] === '--apply' && !apply) apply = true;
    else throw new ConfigurationError('Unexpected argument. Use --help for the approved fixed-scope invocation.');
  }
  const config = configuration(ownerId);
  printPlan(config, apply);
  if (!apply) return;
  await provision(config, await bearerFromStdin());
  console.log('WIF configuration verified. Set these non-secret GitHub Actions repository variables:');
  console.log(`GCP_WORKLOAD_IDENTITY_PROVIDER=${config.provider}`);
  console.log(`GCP_SERVICE_ACCOUNT=${config.serviceAccount}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof ConfigurationError ? error.message : 'Configuration failed unexpectedly; no credential details were logged.');
    process.exitCode = 1;
  });
}
