import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, getRedirectResult, onIdTokenChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, type DocumentData } from 'firebase/firestore';
import { auth, db, friendlyError, missingConfig, redirectEnabled } from './firebase';
import { Brand, Icon } from './ui';
import { deriveAccess } from './accounts-domain';
import AccountManagement from './AccountManagement';
import { editorFor, emptyEditor, formatDate, STATUS_LABELS, validateEditor, type Announcement, type AnnouncementStatus, type EditorValues, type SaveAction } from './domain';

function Gate({ children }: { children: ReactNode }) {
  return <div className="gate-page"><header className="gate-header"><Brand /><span className="header-label">公告管理平台</span></header><main className="gate-wrap"><div className="gate-intro"><p className="eyebrow">CONNECTED CAMPUS</p><h1>讓重要消息，<br />傳遞到位。</h1><p>從一則校園消息到每個人的手機，<br />在這裡建立、排程與管理 CK APP 公告。</p><div className="gate-points"><span><Icon name="file" />編輯公告</span><span><Icon name="clock" />預約發布</span><span><Icon name="bell" />手機通知</span></div><span className="gate-grid" aria-hidden="true" /></div><section className="gate-card">{children}</section></main><footer className="gate-footer">CK APP · 你的校園助理<span>僅供授權管理員使用</span></footer></div>;
}

function SetupRequired() {
  return <Gate><div className="gate-icon"><Icon name="shield" size={25} /></div><p className="eyebrow">SETUP REQUIRED</p><h2>完成專案連線</h2><p className="muted">這個管理平台尚未連接 Firebase。請由專案管理者填入網站的 Firebase 設定，再重新部署。</p><div className="setup-detail"><strong>需要的公開設定</strong><code>{missingConfig.join(' · ')}</code></div><p className="small muted">設定方式請參閱網站專案的 README.md。完成連線後，即可使用管理員 Google 帳戶登入。</p></Gate>;
}

type Session = { status: 'loading' | 'signed-out' | 'admin' | 'denied' | 'error'; user: User | null; canManageAccounts: boolean };

function AuthenticatedApp() {
  const [session, setSession] = useState<Session>({ status: 'loading', user: null, canManageAccounts: false });
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [authRetry, setAuthRetry] = useState(0);
  const [page, setPage] = useState<'announcements' | 'accounts'>('announcements');
  const observedUid = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    let unsubscribeInvitation = () => {};
    getRedirectResult(auth!).catch(error => { if (active) setAuthError(friendlyError(error)); });
    const unsubscribe = onIdTokenChanged(auth!, async user => {
      const current = ++revision;
      unsubscribeInvitation(); unsubscribeInvitation = () => {};
      if (!user) { observedUid.current = null; setSession({ status: 'signed-out', user: null, canManageAccounts: false }); return; }
      if (observedUid.current !== user.uid) setSession({ status: 'loading', user, canManageAccounts: false });
      observedUid.current = user.uid;
      try {
        const result = await user.getIdTokenResult();
        if (!active || current !== revision) return;
        const identity = {
          adminClaim: result.claims.admin,
          accountManagerClaim: result.claims.accountManager,
          email: typeof result.claims.email === 'string' ? result.claims.email : user.email,
          emailVerified: result.claims.email_verified === true,
          signInProvider: result.signInProvider,
        };
        const access = deriveAccess({ ...identity, invitation: null });
        if (access.isAdmin || !access.invitationEmail) {
          setSession({ status: access.isAdmin ? 'admin' : 'denied', user, canManageAccounts: access.canManageAccounts });
          setAuthError('');
          return;
        }
        setSession(previous => previous.status === 'admin' && previous.user?.uid === user.uid
          ? { ...previous, user, canManageAccounts: false }
          : { status: 'loading', user, canManageAccounts: false });
        let serverConfirmed = false;
        unsubscribeInvitation = onSnapshot(doc(db!, 'adminAccounts', access.invitationEmail), { includeMetadataChanges: true }, snapshot => {
          if (!active || current !== revision) return;
          // A cached invitation cannot establish access after a new sign-in.
          if (!serverConfirmed && snapshot.metadata.fromCache) return;
          serverConfirmed = true;
          const data = snapshot.data();
          const invitation = data && typeof data.email === 'string' && typeof data.enabled === 'boolean'
            ? { email: data.email, enabled: data.enabled } : null;
          const liveAccess = deriveAccess({ ...identity, invitation });
          setAuthError('');
          setSession({ status: liveAccess.isAdmin ? 'admin' : 'denied', user, canManageAccounts: liveAccess.canManageAccounts });
        }, error => {
          if (!active || current !== revision) return;
          setAuthError(friendlyError(error));
          setSession({ status: 'error', user, canManageAccounts: false });
        });
      } catch (error) {
        if (active && current === revision) { setAuthError(friendlyError(error)); setSession({ status: 'error', user, canManageAccounts: false }); }
      }
    }, error => { if (active) { unsubscribeInvitation(); setAuthError(friendlyError(error)); setSession({ status: 'error', user: auth!.currentUser, canManageAccounts: false }); } });
    return () => { active = false; unsubscribe(); unsubscribeInvitation(); };
  }, [authRetry]);
  useEffect(() => {
    if (!session.canManageAccounts || session.status !== 'admin') setPage('announcements');
  }, [session.canManageAccounts, session.status]);

  async function login(redirect = false) {
    setSigningIn(true); setAuthError(''); setPopupBlocked(false);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      if (redirect) await signInWithRedirect(auth!, provider);
      else await signInWithPopup(auth!, provider);
    } catch (error) {
      setAuthError(friendlyError(error));
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/popup-blocked') setPopupBlocked(true);
    } finally { setSigningIn(false); }
  }
  async function logout() {
    try { await signOut(auth!); setAuthError(''); } catch (error) { setAuthError(friendlyError(error)); }
  }
  async function refresh() {
    setAuthError(''); setSigningIn(true);
    try { await session.user?.getIdToken(true); setAuthRetry(previous => previous + 1); } catch (error) { setAuthError(friendlyError(error)); }
    finally { setSigningIn(false); }
  }
  if (session.status === 'admin' && session.user) return <div className="dashboard"><header className="app-header"><Brand /><div className="header-divider" /><nav className="admin-navigation" aria-label="管理導覽"><button className={page === 'announcements' ? 'navigation-tab active' : 'navigation-tab'} aria-current={page === 'announcements' ? 'page' : undefined} onClick={() => setPage('announcements')}>公告中心</button>{session.canManageAccounts && <button className={page === 'accounts' ? 'navigation-tab active' : 'navigation-tab'} aria-current={page === 'accounts' ? 'page' : undefined} onClick={() => setPage('accounts')}>帳戶管理</button>}</nav><div className="user-area"><span className="admin-tag"><Icon name="shield" size={14} />{session.canManageAccounts ? '擁有者' : '管理員'}</span><span className="user-email" title={session.user.email ?? ''}>{session.user.email}</span><button className="icon-button" onClick={() => void refresh()} aria-label="重新確認權限" disabled={signingIn}><Icon name="refresh" size={17} /></button><button className="icon-button" onClick={() => void logout()} aria-label="登出"><Icon name="logout" /></button></div></header><div hidden={page !== 'announcements'}><Dashboard user={session.user} authError={authError} /></div>{session.canManageAccounts && <div hidden={page !== 'accounts'}><AccountManagement user={session.user} /></div>}</div>;
  return <Gate><div className="gate-icon"><Icon name="shield" size={25} /></div><p className="eyebrow">ADMIN ACCESS</p><h2>{session.status === 'denied' ? '此帳戶尚未獲得授權' : session.status === 'loading' ? '正在確認登入狀態' : session.status === 'error' ? '無法確認管理員權限' : '歡迎回來'}</h2>
    {session.status === 'loading' ? <p className="muted" role="status">正在安全連線，請稍候…</p> : session.status === 'signed-out' ? <><p className="muted">使用已授權的 Google 帳戶登入，<br />開始管理 App 的最新消息。</p><button className="button primary login-button" onClick={() => void login()} disabled={signingIn}><span className="google-icon" aria-hidden="true">G</span>{signingIn ? '正在登入…' : '使用 Google 帳戶登入'}<Icon name="arrow" /></button>{popupBlocked && redirectEnabled && <button className="button secondary full" onClick={() => void login(true)} disabled={signingIn}>改用整頁登入</button>}<p className="small muted gate-note">登入後仍需具備專案管理者授予的管理員權限。</p></> : <><p className="muted">{session.user?.email && <strong className="account-email">{session.user.email}<br /></strong>}請聯絡專案管理者確認此帳戶的管理員權限。授權完成後可重新確認。</p><button className="button primary full" onClick={() => void refresh()} disabled={signingIn}><Icon name="refresh" />重新確認權限</button><button className="button secondary full" onClick={() => void logout()}><Icon name="logout" />登出並切換帳戶</button></>}
    {authError && <p role="alert" className="notice error">{authError}</p>}
  </Gate>;
}

function dateValue(value: unknown): Date | null { return value instanceof Timestamp ? value.toDate() : null; }
function decodeAnnouncement(id: string, data: DocumentData): Announcement | null {
  const publishAt = dateValue(data.publishAt);
  if (typeof data.title !== 'string' || typeof data.body !== 'string' || typeof data.url !== 'string' || typeof data.createdBy !== 'string' || !publishAt || !Object.hasOwn(STATUS_LABELS, data.status)) return null;
  return { id, title: data.title, body: data.body, url: data.url, status: data.status, publishAt, publishedAt: dateValue(data.publishedAt), createdAt: dateValue(data.createdAt), updatedAt: dateValue(data.updatedAt), createdBy: data.createdBy };
}

const filters: ('all' | AnnouncementStatus)[] = ['all', 'scheduled', 'draft', 'published', 'archived'];

function Dashboard({ user, authError }: { user: User; authError: string }) {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<'all' | AnnouncementStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<EditorValues>(() => emptyEditor());
  const [baseline, setBaseline] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof EditorValues, string>>>({});
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const selected = rows.find(row => row.id === selectedId);
  const editable = !selectedId || selected?.status === 'draft' || selected?.status === 'scheduled';
  const busy = saving || loading || !!listError;
  const visible = rows.filter(row => filter === 'all' || row.status === filter);

  useEffect(() => {
    if (!dirty && selected) {
      setValues(editorFor(selected));
      setBaseline(selected.updatedAt?.getTime() ?? null);
    }
  }, [dirty, selected]);

  useEffect(() => {
    setLoading(true); setListError('');
    return onSnapshot(query(collection(db!, 'announcements'), orderBy('createdAt', 'desc'), limit(200)), snapshot => {
      const records = snapshot.docs.map(item => decodeAnnouncement(item.id, item.data())).filter((item): item is Announcement => item !== null);
      setRows(records); setLoading(false);
      setListError(records.length !== snapshot.docs.length ? '部分公告格式不正確，請由專案管理者檢查資料。' : '');
    }, error => { setRows([]); setLoading(false); setListError(friendlyError(error)); });
  }, [retry]);

  function openAnnouncement(row: Announcement | null) {
    if (saving) return;
    if (dirty && !window.confirm('目前有尚未儲存的變更。要捨棄變更嗎？')) return;
    setSelectedId(row?.id ?? null); setValues(row ? editorFor(row) : emptyEditor());
    setBaseline(row?.updatedAt?.getTime() ?? null); setErrors({}); setActionError(''); setSuccess(''); setDirty(false);
    if (!row) requestAnimationFrame(() => titleInput.current?.focus());
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(field: keyof EditorValues, value: string) {
    setValues(previous => ({ ...previous, [field]: value })); setDirty(true); setSuccess('');
    setErrors(previous => ({ ...previous, [field]: undefined }));
  }
  async function save(action: SaveAction) {
    if (busy || !editable) return;
    const result = validateEditor(values, action);
    setErrors(result.errors); setActionError(''); setSuccess('');
    if (Object.keys(result.errors).length) {
      document.getElementById(Object.keys(result.errors)[0])?.focus(); return;
    }
    setSaving(true);
    try {
      const data = { title: result.data.title, body: result.data.body, url: result.data.url, status: result.data.status, publishAt: Timestamp.fromDate(result.data.publishAt), updatedAt: serverTimestamp() };
      let savedId = selectedId;
      if (selectedId) {
        await runTransaction(db!, async transaction => {
          const ref = doc(db!, 'announcements', selectedId);
          const current = await transaction.get(ref);
          if (!current.exists() || !['draft', 'scheduled'].includes(current.data().status)) throw new Error('content-published');
          if ((dateValue(current.data().updatedAt)?.getTime() ?? null) !== baseline) throw new Error('content-changed');
          transaction.update(ref, data);
        });
      } else {
        const created = await addDoc(collection(db!, 'announcements'), { ...data, publishedAt: null, createdAt: serverTimestamp(), createdBy: user.uid });
        savedId = created.id;
      }
      setSelectedId(savedId); setDirty(false);
      setSuccess(action === 'draft' ? '草稿已儲存。' : action === 'now' ? '已送出發布。公告約每 5 分鐘處理一次，排程可能延遲。' : '排程已儲存，將於設定時間後的下一輪處理發布；排程可能延遲。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setActionError(message === 'content-published' ? '這則公告已發布或封存，無法繼續編輯。請重新選取公告。' : message === 'content-changed' ? '其他管理員已更新這則公告。請重新選取並確認最新內容後再編輯。' : friendlyError(error));
    } finally { setSaving(false); }
  }
  async function archive() {
    if (!selectedId || busy || selected?.status !== 'published') return;
    if (!window.confirm('封存後，App 將不再顯示這則公告。確定要封存嗎？')) return;
    setSaving(true); setActionError(''); setSuccess('');
    try {
      await runTransaction(db!, async transaction => {
        const ref = doc(db!, 'announcements', selectedId);
        const current = await transaction.get(ref);
        if (current.data()?.status !== 'published') throw new Error('archive-changed');
        transaction.update(ref, { status: 'archived', updatedAt: serverTimestamp() });
      });
      setDirty(false); setSuccess('公告已封存。');
    } catch (error) { setActionError(error instanceof Error && error.message === 'archive-changed' ? '這則公告的狀態已變更，請重新選取。' : friendlyError(error)); }
    finally { setSaving(false); }
  }

  return <>
    <main className="workspace"><div className="page-heading"><div><p className="eyebrow">ANNOUNCEMENTS</p><h1>每個重要消息，都在這裡。</h1><p className="muted">管理 App 首頁公告，輕鬆安排校園消息的發布時間。</p></div><button className="button primary" onClick={() => openAnnouncement(null)} disabled={saving}><Icon name="plus" />建立公告</button></div>
      <div className="stats"><Stat icon="bell" label="已發布" value={rows.filter(row => row.status === 'published').length} detail="正在 App 中顯示" /><Stat icon="clock" label="已排程" value={rows.filter(row => row.status === 'scheduled').length} detail="等待自動發布" /><Stat icon="file" label="草稿" value={rows.filter(row => row.status === 'draft').length} detail="持續醞釀的消息" /></div>
      <div className="schedule-note"><span className="note-icon"><Icon name="clock" size={17} /></span><p>先安排，再安心分享。<span>時間均為台北時間（UTC+8）；公告約每 5 分鐘處理一次，排程可能延遲。發布後送出裝置通知。</span></p></div>
      {authError && <p className="notice error" role="alert">{authError}</p>}
      <div className="content-grid"><section className="panel list-panel" aria-labelledby="list-title"><div className="panel-heading"><h2 id="list-title">公告列表 <span className="count">{rows.length}</span></h2><span className="live-dot">即時同步</span></div><div className="filters" role="group" aria-label="依公告狀態篩選">{filters.map(item => <button key={item} className={filter === item ? 'filter active' : 'filter'} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? '全部' : STATUS_LABELS[item]}</button>)}</div>
        <div className="announcement-list" aria-live="polite">{loading ? <div className="list-empty"><span className="spinner" /><p>正在載入公告…</p></div> : listError ? <div className="list-empty"><Icon name="refresh" size={32} /><p className="notice error" role="alert">{listError}</p><button className="button secondary" onClick={() => setRetry(previous => previous + 1)}>重新載入</button></div> : visible.length === 0 ? <div className="list-empty"><div className="empty-icon"><Icon name="file" size={28} /></div><h3>{filter === 'all' ? '第一則消息，從這裡開始' : `目前沒有${STATUS_LABELS[filter]}公告`}</h3><p>{filter === 'all' ? '建立一則公告，與同學分享校園的新鮮事。' : '符合這個狀態的公告會顯示在這裡。'}</p>{filter === 'all' && <button className="text-button" onClick={() => openAnnouncement(null)}>建立第一則公告 <Icon name="arrow" size={16} /></button>}</div> : visible.map(row => <button className={`announcement-row ${selectedId === row.id ? 'selected' : ''}`} key={row.id} onClick={() => openAnnouncement(row)} aria-pressed={selectedId === row.id}><div className="row-top"><StatusBadge status={row.status} /><span className="row-date">{formatDate(row.status === 'published' ? row.publishedAt : row.publishAt)}</span></div><h3>{row.title}</h3><p>{row.body}</p><div className="row-bottom"><span>{row.status === 'draft' ? '繼續編輯' : row.status === 'scheduled' ? '檢視排程' : '檢視公告'}</span><Icon name="arrow" size={16} /></div></button>)}</div><div className="list-footer">顯示最近 200 則公告 · 台北時間</div>
      </section>
      <section className="panel editor-panel" aria-labelledby="editor-title"><div className="panel-heading"><div><p className="eyebrow">{selectedId ? 'ANNOUNCEMENT DETAILS' : 'CREATE ANNOUNCEMENT'}</p><h2 id="editor-title">{selectedId ? editable ? '編輯公告' : '公告內容' : '建立新公告'}</h2></div>{selected && <StatusBadge status={selected.status} />}{dirty && <span className="unsaved">尚未儲存</span>}</div>
        <form className="editor-form" onSubmit={event => { event.preventDefault(); void save('draft'); }}>
          <fieldset disabled={!editable || saving}><div className="field"><div className="label-line"><label htmlFor="title">公告標題 <span className="required">*</span></label><span className="input-count">{values.title.length} / 120</span></div><input ref={titleInput} id="title" value={values.title} placeholder="用一句話，說出重要的事" maxLength={120} onChange={event => change('title', event.target.value)} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : undefined} required />{errors.title && <span id="title-error" className="field-error">{errors.title}</span>}</div>
          <div className="field"><div className="label-line"><label htmlFor="body">公告內容 <span className="required">*</span></label><span className="input-count">{values.body.length.toLocaleString()} / 10,000</span></div><textarea id="body" value={values.body} rows={7} placeholder="告訴同學消息的詳細內容、時間與注意事項…" maxLength={10_000} onChange={event => change('body', event.target.value)} aria-invalid={!!errors.body} aria-describedby={errors.body ? 'body-error' : undefined} required />{errors.body && <span id="body-error" className="field-error">{errors.body}</span>}</div>
          <div className="field"><div className="label-line"><label htmlFor="url">延伸連結 <span className="optional">選填</span></label></div><input id="url" type="url" value={values.url} placeholder="https://" maxLength={2048} onChange={event => change('url', event.target.value)} aria-invalid={!!errors.url} aria-describedby={errors.url ? 'url-error' : 'url-help'} />{errors.url ? <span id="url-error" className="field-error">{errors.url}</span> : <span id="url-help" className="field-hint">加入活動頁面、報名表或其他 HTTPS 連結，最多 2,048 個字元。</span>}</div>
          <div className="field"><div className="label-line"><label htmlFor="publishTime">發布時間</label><span className="timezone">Asia/Taipei · UTC+8</span></div><input id="publishTime" type="datetime-local" value={values.publishTime} onChange={event => change('publishTime', event.target.value)} aria-invalid={!!errors.publishTime} aria-describedby={errors.publishTime ? 'time-error' : 'time-help'} />{errors.publishTime ? <span id="time-error" className="field-error">{errors.publishTime}</span> : <span id="time-help" className="field-hint">排程前請確認日期與時間；草稿不會自動發布。</span>}</div></fieldset>
          {!editable && <div className="notice neutral" role="status"><p>{selected?.status === 'archived' ? '這則公告已封存，App 中不再顯示。' : selected?.status === 'published' ? '這則公告已發布，內容無法再編輯。需要下架時，可將它封存。' : '公告狀態已更新，請重新選取公告。'}</p>{dirty && selected && <><p>畫面保留了尚未儲存的變更，這些變更並未發布。請載入已儲存內容，確認實際公告。</p><button type="button" className="text-button" onClick={() => openAnnouncement(selected)} disabled={saving}>載入已儲存內容 <Icon name="refresh" size={15} /></button></>}</div>}
          {actionError && <p className="notice error" role="alert">{actionError}</p>}{success && <p className="notice success" role="status"><Icon name="check" size={17} />{success}</p>}
          <div className="editor-actions">{editable ? <><button type="submit" className="button secondary" disabled={busy}>儲存草稿</button><div className="publish-actions"><button type="button" className="button secondary" onClick={() => void save('now')} disabled={busy}>立即發布</button><button type="button" className="button primary" onClick={() => void save('schedule')} disabled={busy}><Icon name="clock" size={17} />{saving ? '正在儲存…' : '排程發布'}</button></div></> : selected?.status === 'published' ? <button type="button" className="button secondary" onClick={() => void archive()} disabled={busy}><Icon name="archive" />封存公告</button> : null}</div>
        </form>
        <div className="preview-section"><div className="preview-heading"><h3>App 顯示預覽</h3><span>{dirty && !editable ? '尚未儲存的內容' : '內容樣式參考'}</span></div><div className="phone-preview"><div className="preview-app-title"><span className="preview-small-mark">CK</span><span>最新消息</span><span className="preview-sample">預覽</span></div><article className="preview-card"><p className="preview-date"><Icon name="bell" size={14} />{values.publishTime ? formatDate(validateEditor(values, 'draft').data.publishAt) : '發布日期'}</p><h4>{values.title.trim() || '你的公告標題'}</h4><p className={!values.body.trim() ? 'placeholder' : ''}>{values.body.trim() || '公告內容將顯示在這裡。讓重要資訊清楚、簡單地被看見。'}</p>{values.url.trim() && <span className="preview-link">查看詳細資訊 <Icon name="arrow" size={15} /></span>}</article></div></div>
      </section></div>
    </main><footer className="workspace-footer">CK APP · 公告管理平台<span>為校園生活，多想一步。</span></footer>
  </>;
}

function StatusBadge({ status }: { status: AnnouncementStatus }) { return <span className={`status-badge ${status}`}><span />{STATUS_LABELS[status]}</span>; }
function Stat({ icon, label, value, detail }: { icon: 'bell' | 'clock' | 'file'; label: string; value: number; detail: string }) { return <div className="stat"><div className={`stat-icon ${icon}`}><Icon name={icon} size={22} /></div><div><p>{label}<span>{detail}</span></p><strong>{value.toString().padStart(2, '0')}</strong></div></div>; }
export default function App() { return missingConfig.length ? <SetupRequired /> : <AuthenticatedApp />; }
