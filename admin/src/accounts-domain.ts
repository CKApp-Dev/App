export interface Invitation {
  email: string;
  displayName: string;
  enabled: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
}

export interface AccessInput {
  adminClaim: unknown;
  accountManagerClaim: unknown;
  email: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  invitation: Pick<Invitation, 'email' | 'enabled'> | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (/[\u0000-\u001f\u007f]/.test(email) || normalized.length > 254) return false;
  if (!/^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(normalized)) {
    return false;
  }
  const local = normalized.slice(0, normalized.indexOf('@'));
  return !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
}

export function validateInvite(email: string, displayName: string, currentEmail: string | null) {
  const errors: { email?: string; displayName?: string } = {};
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = displayName.trim();

  if (!isValidEmail(email)) {
    errors.email = '請輸入有效的電子郵件地址（最多 254 個字元）。';
  } else if (currentEmail !== null && normalizedEmail === normalizeEmail(currentEmail)) {
    errors.email = '無法透過受邀帳號清單管理您自己的帳號。';
  }
  if (normalizedName.length > 120) {
    errors.displayName = '顯示名稱不可超過 120 個字元。';
  }

  return {
    errors,
    data: { email: normalizedEmail, displayName: normalizedName, enabled: true as const },
  };
}

export function deriveAccess(input: AccessInput): {
  isAdmin: boolean;
  canManageAccounts: boolean;
  invitationEmail: string | null;
} {
  const claimAdmin = input.adminClaim === true;
  const invitationEmail = input.emailVerified === true
    && input.signInProvider === 'google.com'
    && input.email !== null
    && isValidEmail(input.email)
    ? normalizeEmail(input.email)
    : null;
  const invitedAdmin = invitationEmail !== null
    && input.invitation?.email === invitationEmail
    && input.invitation.enabled === true;

  return {
    isAdmin: claimAdmin || invitedAdmin,
    canManageAccounts: claimAdmin && input.accountManagerClaim === true,
    invitationEmail,
  };
}
