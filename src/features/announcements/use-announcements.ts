import { useIsFocused } from 'expo-router';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getFirebaseClient } from '@/lib/firebase';

import { parseAnnouncement, validAnnouncementId, type Announcement } from './model';

export function publishedAnnouncementsQuery() {
  const firebase = getFirebaseClient();
  return firebase ? query(collection(firebase.db, 'announcements'), where('status', '==', 'published'), orderBy('publishAt', 'desc'), limit(50)) : null;
}

/** Live while visible; reconnect after a background interval or explicit retry. */
export function useAnnouncements() {
  const focused = useIsFocused();
  const [data, setData] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const configured = !!getFirebaseClient();

  useEffect(() => {
    if (!focused || !configured) return;
    let unsubscribe: (() => void) | undefined;
    function connect() {
      unsubscribe?.();
      const source = publishedAnnouncementsQuery();
      if (!source) return;
      unsubscribe = onSnapshot(source, (snapshot) => {
        setData(snapshot.docs.flatMap((entry) => {
          const item = parseAnnouncement(entry.id, entry.data());
          return item ? [item] : [];
        }));
        setLoading(false);
        setError(false);
      }, () => { setError(true); setLoading(false); });
    }
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') connect();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') connect();
      else { unsubscribe?.(); unsubscribe = undefined; }
    });
    return () => { unsubscribe?.(); subscription.remove(); };
  }, [focused, configured, attempt]);

  const refetch = useCallback(async () => {
    const source = publishedAnnouncementsQuery();
    if (!source) return;
    // Also restarts a listener that terminated after a permissions/network error.
    setAttempt((value) => value + 1);
    try {
      const snapshot = await getDocs(source);
      setData(snapshot.docs.flatMap((entry) => {
        const item = parseAnnouncement(entry.id, entry.data());
        return item ? [item] : [];
      }));
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  return { data, loading: configured && loading, error, configured, refetch };
}

export function useAnnouncement(id: string | undefined) {
  const focused = useIsFocused();
  const [result, setResult] = useState<{ id: string; data: Announcement | null; error: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const configured = !!getFirebaseClient();
  useEffect(() => {
    const firebase = getFirebaseClient();
    if (!firebase || !validAnnouncementId(id) || !focused) return;
    const requestedId = id;
    let unsubscribe: (() => void) | undefined;
    function connect() {
      unsubscribe?.();
      unsubscribe = onSnapshot(doc(firebase!.db, 'announcements', requestedId), (snapshot) => {
        setResult({ id: requestedId, data: snapshot.exists() ? parseAnnouncement(snapshot.id, snapshot.data()) : null, error: false });
      }, () => {
        // Archiving also revokes public read access to an already-open detail.
        setResult({ id: requestedId, data: null, error: true });
      });
    }
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') connect();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') connect();
      else { unsubscribe?.(); unsubscribe = undefined; }
    });
    return () => { unsubscribe?.(); subscription.remove(); };
  }, [id, configured, focused, attempt]);
  const current = validAnnouncementId(id) && result?.id === id ? result : null;
  return {
    data: current?.data ?? null,
    loading: configured && validAnnouncementId(id) && !current,
    error: current?.error ?? false,
    configured,
    retry: () => setAttempt((value) => value + 1),
  };
}
