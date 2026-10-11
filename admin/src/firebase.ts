import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import defaults from './firebase-config.json';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || defaults.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || defaults.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || defaults.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || defaults.appId,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || defaults.messagingSenderId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || defaults.storageBucket || undefined,
};

export const missingConfig = Object.entries(config)
  .filter(([key, value]) => key !== 'storageBucket' && !value)
  .map(([key]) => key);
export const redirectEnabled = import.meta.env.VITE_FIREBASE_ENABLE_REDIRECT === 'true';
const app = missingConfig.length === 0 ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export function friendlyError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '登入已取消，請再試一次。';
  if (code === 'auth/popup-blocked') return '瀏覽器封鎖了登入視窗。請允許此網站開啟彈出式視窗，再重新登入。';
  if (code === 'auth/unauthorized-domain') return '此網站網域尚未獲得 Firebase 登入授權，請聯絡專案管理者。';
  if (code === 'auth/operation-not-allowed') return 'Google 登入尚未啟用，請聯絡專案管理者。';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return '無法連線，請確認網路後重試。';
  if (code === 'permission-denied') return '沒有操作權限。請重新登入，或請管理者確認你的權限。';
  if (code === 'failed-precondition') return '資料庫尚未完成設定，請聯絡專案管理者。';
  return '操作未完成，請稍後重試。若持續發生，請聯絡專案管理者。';
}
