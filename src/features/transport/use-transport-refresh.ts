import { useRef, useState } from 'react';

/** Header and pull-to-refresh share the same pending request. */
export function useTransportRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);

  function refresh(): Promise<void> {
    if (inFlight.current) return inFlight.current;
    setRefreshing(true);
    inFlight.current = Promise.resolve()
      .then(refetch)
      .then(() => undefined)
      .finally(() => {
        setRefreshing(false);
        inFlight.current = null;
      });
    return inFlight.current;
  }

  return { refreshing, refresh };
}
