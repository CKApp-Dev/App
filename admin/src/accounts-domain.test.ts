import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAccess, normalizeEmail, validateInvite } from './accounts-domain.ts';
import type { AccessInput } from './accounts-domain.ts';

const member: AccessInput = {
  adminClaim: false,
  accountManagerClaim: false,
  email: 'Member.Name+news@example.com',
  emailVerified: true,
  signInProvider: 'google.com',
  invitation: { email: 'member.name+news@example.com', enabled: true },
};

test('email normalization trims and lowercases while preserving dots and plus aliases', () => {
  assert.equal(normalizeEmail('  Member.Name+NEWS@Example.COM  '), 'member.name+news@example.com');
  const invite = validateInvite('  Member.Name+NEWS@Example.COM  ', '  公告編輯  ', 'owner@example.com');
  assert.deepEqual(invite.errors, {});
  assert.deepEqual(invite.data, {
    email: 'member.name+news@example.com', displayName: '公告編輯', enabled: true,
  });
  assert.notEqual(normalizeEmail('first.last@gmail.com'), normalizeEmail('firstlast@gmail.com'));
  assert.notEqual(normalizeEmail('member+news@gmail.com'), normalizeEmail('member@gmail.com'));
});

test('invites reject document paths, control characters, invalid syntax, and oversized emails', () => {
  for (const email of [
    '', 'member', 'member@example', 'member@.example.com', 'member@example..com',
    'member@-example.com', 'member@example-.com', 'member@example.com.',
    'member/other@example.com', 'members/member@example.com', 'member@example.com/other',
    'member\\other@example.com', 'member name@example.com', 'member@example .com',
    'member\t@example.com', 'member@example.com\n', 'member\r@example.com',
    'member\u0000@example.com', 'member\u007f@example.com', 'member@@example.com',
    'member<script>@example.com', '"member"@example.com', '.member@example.com',
    'member.@example.com', 'mem..ber@example.com', `${'m'.repeat(243)}@example.com`,
  ]) {
    assert.ok(validateInvite(email, '', null).errors.email, JSON.stringify(email));
    assert.equal(deriveAccess({ ...member, email }).invitationEmail, null, JSON.stringify(email));
  }
  const maximumLength = `${'m'.repeat(242)}@example.com`;
  assert.equal(maximumLength.length, 254);
  assert.deepEqual(validateInvite(maximumLength, '', null).errors, {});
});

test('self-invites compare normalized emails without canonicalizing Google aliases', () => {
  assert.ok(validateInvite(' OWNER@EXAMPLE.COM ', '', ' owner@example.com ').errors.email);
  assert.deepEqual(validateInvite('owner+editor@example.com', '', 'owner@example.com').errors, {});
  assert.deepEqual(validateInvite('owner.name@gmail.com', '', 'ownername@gmail.com').errors, {});
});

test('display name is optional, trimmed, and bounded to 120 characters', () => {
  assert.equal(validateInvite('member@example.com', '   ', null).data.displayName, '');
  assert.deepEqual(validateInvite('member@example.com', `  ${'a'.repeat(120)}  `, null).errors, {});
  assert.ok(validateInvite('member@example.com', 'a'.repeat(121), null).errors.displayName);
});

test('verified Google members gain authoring only from their exact enabled invitation', () => {
  assert.deepEqual(deriveAccess(member), {
    isAdmin: true, canManageAccounts: false, invitationEmail: 'member.name+news@example.com',
  });
  for (const invitation of [
    null,
    { email: 'member.name+news@example.com', enabled: false },
    { email: 'member.name@example.com', enabled: true },
    { email: 'membername+news@example.com', enabled: true },
    { email: 'Member.Name+news@example.com', enabled: true },
    { email: 'someone.else@example.com', enabled: true },
  ]) {
    assert.equal(deriveAccess({ ...member, invitation }).isAdmin, false);
  }
});

test('invitation lookup requires verified Google identity with a valid email', () => {
  for (const identity of [
    { emailVerified: false },
    { signInProvider: 'password' },
    { signInProvider: null },
    { email: null },
    { email: 'member@example' },
  ]) {
    assert.deepEqual(deriveAccess({ ...member, ...identity }), {
      isAdmin: false, canManageAccounts: false, invitationEmail: null,
    });
  }
  assert.equal(deriveAccess({ ...member, invitation: null }).invitationEmail, 'member.name+news@example.com');
});

test('claim-rooted owners stay administrators independently of invited membership or provider', () => {
  for (const invitation of [null, { email: member.email!, enabled: false }]) {
    assert.deepEqual(deriveAccess({
      ...member, adminClaim: true, accountManagerClaim: true, invitation,
      email: null, emailVerified: false, signInProvider: 'password',
    }), { isAdmin: true, canManageAccounts: true, invitationEmail: null });
  }
  assert.equal(deriveAccess({ ...member, adminClaim: true, invitation: null }).canManageAccounts, false);
});

test('only strict boolean admin and manager claims grant account management', () => {
  for (const adminClaim of [false, null, undefined, 1, 'true', {}]) {
    const invited = deriveAccess({ ...member, adminClaim, accountManagerClaim: true });
    assert.equal(invited.isAdmin, true);
    assert.equal(invited.canManageAccounts, false);
    const uninvited = deriveAccess({ ...member, adminClaim, accountManagerClaim: true, invitation: null });
    assert.equal(uninvited.isAdmin, false);
    assert.equal(uninvited.canManageAccounts, false);
  }
  for (const accountManagerClaim of [false, null, undefined, 1, 'true', {}]) {
    assert.equal(deriveAccess({ ...member, adminClaim: true, accountManagerClaim }).canManageAccounts, false);
  }
});
