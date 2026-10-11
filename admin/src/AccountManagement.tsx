import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, type DocumentData } from 'firebase/firestore';
import { db, friendlyError } from './firebase';
import { normalizeEmail, validateInvite, type Invitation } from './accounts-domain';
import { formatDate } from './domain';
import { Icon } from './ui';

function decodeInvitation(id: string, data: DocumentData): Invitation | null {
  if (data.email !== id || normalizeEmail(id) !== id || typeof data.displayName !== 'string' || typeof data.enabled !== 'boolean' || typeof data.createdBy !== 'string') return null;
  return {
    email: id, displayName: data.displayName, enabled: data.enabled, createdBy: data.createdBy,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

export default function AccountManagement({ user }: { user: User }) {
  const [rows, setRows] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; displayName?: string }>({});
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [nameBaseline, setNameBaseline] = useState<number | null>(null);
  const [nameError, setNameError] = useState('');
  const emailInput = useRef<HTMLInputElement>(null);
  const ownerEmail = normalizeEmail(user.email ?? '');
  const invitedRows = rows.filter(row => row.email !== ownerEmail);
  const visibleRows = invitedRows.filter(row => filter === 'all' || row.enabled === (filter === 'enabled'));
  const busy = creating || pendingEmail !== null;

  useEffect(() => {
    setLoading(true); setListError('');
    return onSnapshot(query(collection(db!, 'adminAccounts'), orderBy('createdAt', 'desc')), snapshot => {
      const invitations = snapshot.docs.map(item => decodeInvitation(item.id, item.data())).filter((item): item is Invitation => item !== null);
      setRows(invitations); setLoading(false);
      setListError(invitations.length === snapshot.docs.length ? '' : '部分邀請資料格式不正確，請聯絡專案管理者檢查。');
    }, error => { setRows([]); setLoading(false); setListError(friendlyError(error)); });
  }, [retry]);

  async function invite() {
    if (busy || loading || listError) return;
    const result = validateInvite(email, displayName, user.email);
    setFormErrors(result.errors); setInviteError(''); setInviteSuccess('');
    if (Object.keys(result.errors).length) {
      document.getElementById(result.errors.email ? 'invite-email' : 'invite-name')?.focus();
      return;
    }
    setCreating(true);
    try {
      await runTransaction(db!, async transaction => {
        const ref = doc(db!, 'adminAccounts', result.data.email);
        const existing = await transaction.get(ref);
        if (existing.exists()) throw new Error('invitation-exists');
        transaction.set(ref, { ...result.data, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      setEmail(''); setDisplayName('');
      setInviteSuccess(`已邀請 ${result.data.email}。請將網站連結提供給對方，並以同一個 Google 帳戶登入。`);
      emailInput.current?.focus();
    } catch (error) {
      setInviteError(error instanceof Error && error.message === 'invitation-exists' ? '這個電子郵件已在邀請名單。若已停用，可從列表重新啟用。' : friendlyError(error));
    } finally { setCreating(false); }
  }

  async function updateInvitation(row: Invitation, action: 'name' | 'toggle' | 'remove') {
    if (busy || row.email === ownerEmail) return;
    const nextName = editedName.trim();
    setNameError(''); setActionError(''); setActionSuccess('');
    if (action === 'name' && nextName.length > 120) { setNameError('顯示名稱不可超過 120 個字元。'); return; }
    if (action === 'toggle' && row.enabled && !window.confirm(`停用 ${row.email} 的邀請權限嗎？這會撤銷這份邀請授予的公告管理權限。如果對方另有獨立授予的專案角色，須由專案管理者另外調整。`)) return;
    if (action === 'remove' && !window.confirm(`移除 ${row.email} 的邀請嗎？這會撤銷這份邀請授予的權限，既有公告與 Google 帳戶不會被刪除。如果對方另有獨立授予的專案角色，須由專案管理者另外調整。`)) return;
    setPendingEmail(row.email);
    try {
      await runTransaction(db!, async transaction => {
        const ref = doc(db!, 'adminAccounts', row.email);
        const current = await transaction.get(ref);
        if (!current.exists()) throw new Error('invitation-missing');
        const updatedAt = current.data().updatedAt;
        const expectedVersion = action === 'name' ? nameBaseline : row.updatedAt?.getTime() ?? null;
        if ((updatedAt instanceof Timestamp ? updatedAt.toDate().getTime() : null) !== expectedVersion) throw new Error('invitation-changed');
        if (action === 'remove') transaction.delete(ref);
        else transaction.update(ref, {
          ...(action === 'name' ? { displayName: nextName } : { enabled: !row.enabled }),
          updatedAt: serverTimestamp(),
        });
      });
      if (action === 'name' || action === 'remove') setEditingEmail(null);
      setActionSuccess(action === 'name' ? '顯示名稱已更新。' : action === 'remove' ? '邀請已移除；獨立授予的專案角色不受影響。' : row.enabled ? '這份邀請授予的權限已停用；獨立授予的專案角色不受影響。' : '邀請權限已重新啟用。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setActionError(message === 'invitation-missing' ? '這份邀請已被移除，請確認最新名單。' : message === 'invitation-changed' ? '這份邀請剛剛已更新，請確認最新資料後再操作。' : friendlyError(error));
    } finally { setPendingEmail(null); }
  }

  return <><main className="workspace accounts-workspace"><div className="page-heading"><div><p className="eyebrow">TEAM ACCESS</p><h1>帳戶管理</h1><p className="muted">邀請值得信任的夥伴，共同維護校園公告。</p></div><span className="owner-only"><Icon name="shield" size={15} />僅限擁有者</span></div>
    <section className="owner-account" aria-label="受保護的擁有者帳戶"><div className="owner-avatar"><Icon name="shield" size={24} /></div><div><div className="owner-title"><h2>擁有者帳戶</h2><span>目前帳戶 · 受保護</span></div><p className="owner-email">{user.email}</p><p className="owner-explanation">此帳戶的管理權限由專案管理者設定，不受邀請名單的停用或移除影響。</p></div></section>
    <div className="accounts-layout"><section className="panel accounts-list-panel" aria-labelledby="accounts-list-title"><div className="panel-heading"><div><h2 id="accounts-list-title">管理員邀請 <span className="count">{invitedRows.length}</span></h2><p className="accounts-list-hint">已啟用 {invitedRows.filter(row => row.enabled).length} 位 · 已停用 {invitedRows.filter(row => !row.enabled).length} 位</p></div><span className="live-dot">即時同步</span></div><div className="filters" role="group" aria-label="依邀請狀態篩選">{(['all', 'enabled', 'disabled'] as const).map(value => <button key={value} className={filter === value ? 'filter active' : 'filter'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? '全部邀請' : value === 'enabled' ? '已啟用' : '已停用'}</button>)}</div>
      {actionError && <p className="notice error account-action-notice" role="alert">{actionError}</p>}{actionSuccess && <p className="notice success account-action-notice" role="status"><Icon name="check" size={17} />{actionSuccess}</p>}
      <div className="account-list" aria-live="polite">{loading ? <div className="list-empty"><span className="spinner" /><p>正在載入邀請名單…</p></div> : listError ? <div className="list-empty"><p className="notice error" role="alert">{listError}</p><button className="button secondary" onClick={() => setRetry(previous => previous + 1)}>重新載入</button></div> : visibleRows.length === 0 ? <div className="list-empty"><div className="empty-icon"><Icon name="shield" size={28} /></div><h3>{filter === 'all' ? '一起把消息傳得更好' : filter === 'enabled' ? '目前沒有已啟用的邀請' : '目前沒有已停用的邀請'}</h3><p>{filter === 'all' ? '輸入 Google 電子郵件，邀請第一位公告管理員。' : '符合這個狀態的邀請會顯示在這裡。'}</p>{filter === 'all' && <button className="text-button" onClick={() => emailInput.current?.focus()}>邀請管理員 <Icon name="arrow" size={16} /></button>}</div> : visibleRows.map(row => <article className="account-row" key={row.email}><div className="account-row-heading"><div className="member-avatar" aria-hidden="true">{(row.displayName || row.email).slice(0, 1).toUpperCase()}</div><div className="account-identity"><h3>{row.displayName || '未設定顯示名稱'}</h3><p>{row.email}</p></div><span className={`status-badge ${row.enabled ? 'published' : 'draft'}`}><span />{row.enabled ? '已啟用' : '已停用'}</span></div>
        {editingEmail === row.email && <form className="inline-name-form" onSubmit={event => { event.preventDefault(); void updateInvitation(row, 'name'); }}><label htmlFor="edit-display-name">顯示名稱 <span className="optional">選填</span></label><div className="inline-name-fields"><input id="edit-display-name" value={editedName} maxLength={120} onChange={event => { setEditedName(event.target.value); setNameError(''); }} placeholder="例如：活動組小編" disabled={busy} aria-invalid={!!nameError} aria-describedby={nameError ? 'edit-name-error' : undefined} autoFocus /><button className="button primary" type="submit" disabled={busy}>儲存</button><button className="button secondary" type="button" onClick={() => setEditingEmail(null)} disabled={busy}>取消</button></div>{nameError && <p className="field-error" id="edit-name-error">{nameError}</p>}</form>}
        <div className="account-row-footer"><span>邀請於 {formatDate(row.createdAt)}</span><div className="account-row-actions"><button className="text-button" onClick={() => { setEditingEmail(row.email); setEditedName(row.displayName); setNameBaseline(row.updatedAt?.getTime() ?? null); setNameError(''); }} disabled={busy}>編輯名稱</button><button className="text-button" onClick={() => void updateInvitation(row, 'toggle')} disabled={busy}>{pendingEmail === row.email ? '處理中…' : row.enabled ? '停用權限' : '重新啟用'}</button><button className="text-button danger-text" onClick={() => void updateInvitation(row, 'remove')} disabled={busy}>移除邀請</button></div></div></article>)}</div><div className="list-footer">這是管理員邀請名單；登入帳戶會在首次 Google 登入時建立。</div>
    </section><aside className="panel invite-panel" aria-labelledby="invite-title"><div className="panel-heading"><div><p className="eyebrow">INVITE A TEAMMATE</p><h2 id="invite-title">邀請管理員</h2></div><span className="invite-plus"><Icon name="plus" size={20} /></span></div><form className="invite-form" noValidate onSubmit={event => { event.preventDefault(); void invite(); }}><div className="field"><label htmlFor="invite-email">Google 電子郵件 <span className="required">*</span></label><input ref={emailInput} id="invite-email" type="email" autoComplete="off" maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setFormErrors(previous => ({ ...previous, email: undefined })); setInviteSuccess(''); }} placeholder="name@gmail.com" disabled={busy} aria-invalid={!!formErrors.email} aria-describedby={formErrors.email ? 'invite-email-error' : 'invite-email-help'} required />{formErrors.email ? <span id="invite-email-error" className="field-error">{formErrors.email}</span> : <span id="invite-email-help" className="field-hint">也可使用已連結 Google 帳戶的其他電子郵件。請輸入對方實際登入時使用的地址。</span>}</div><div className="field"><label htmlFor="invite-name">顯示名稱 <span className="optional">選填</span></label><input id="invite-name" value={displayName} maxLength={120} onChange={event => { setDisplayName(event.target.value); setFormErrors(previous => ({ ...previous, displayName: undefined })); }} placeholder="例如：活動組小編" disabled={busy} aria-invalid={!!formErrors.displayName} aria-describedby={formErrors.displayName ? 'invite-name-error' : undefined} />{formErrors.displayName && <span id="invite-name-error" className="field-error">{formErrors.displayName}</span>}</div><div className="invite-role"><Icon name="file" size={18} /><div><strong>公告管理員</strong><span>可建立、編輯、排程及封存公告，無法管理其他帳戶。</span></div></div>{inviteError && <p className="notice error" role="alert">{inviteError}</p>}{inviteSuccess && <p className="notice success" role="status">{inviteSuccess}</p>}<button type="submit" className="button primary full" disabled={busy || loading || !!listError}><Icon name="plus" size={17} />{creating ? '正在新增邀請…' : '新增邀請'}</button><p className="invite-footnote">新增邀請會開放登入資格，不會寄送電子郵件。請將本網站連結提供給對方；對方首次以該 Google 帳戶登入時，才會建立登入帳戶。</p></form></aside></div>
  </main><footer className="workspace-footer">CK APP · 帳戶管理<span>讓每一份信任，都有清楚的界線。</span></footer></>;
}
