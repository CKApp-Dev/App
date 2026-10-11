import { createRequire } from 'node:module';
const require = createRequire(new URL('../worker/package.json', import.meta.url));
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const args = process.argv.slice(2);
const emailIndex = args.indexOf('--email');
const projectIndex = args.indexOf('--project');
const email = emailIndex >= 0 ? args[emailIndex + 1]?.trim().toLowerCase() : '';
const projectId = projectIndex >= 0 ? args[projectIndex + 1]?.trim() : '';
const accountManager = args.includes('--account-manager');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !projectId || projectId.startsWith('--')) {
  console.error('Usage: npm run grant-admin -- --project YOUR_PROJECT_ID --email admin@example.com [--account-manager]');
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
if (user.disabled || !user.emailVerified || !user.providerData.some((provider) => provider.providerId === 'google.com' && provider.email?.toLowerCase() === email)) {
  throw new Error('Admin must first sign in with a verified, enabled Google account matching the explicit email.');
}
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true, ...(accountManager ? { accountManager: true } : {}) });
console.log(`Granted ${accountManager ? 'admin and account management' : 'admin'} to ${email} in ${projectId}. Sign out and sign in again to refresh the claim.`);
