import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'intro.seen.v1';

/**
 * Tracks whether the first-run explainer has been dismissed. Backed by
 * expo-secure-store so it persists across launches. `seen` starts true (and only
 * flips false once we've confirmed it was never dismissed) so the overlay never
 * flashes for returning users; gate rendering on `ready && !seen`.
 */
export function useIntroSeen() {
  const [seen, setSeen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const value = await SecureStore.getItemAsync(STORAGE_KEY);
        if (active) setSeen(value === '1');
      } catch {
        if (active) setSeen(true); // storage unavailable — don't nag
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const markSeen = useCallback(() => {
    setSeen(true);
    SecureStore.setItemAsync(STORAGE_KEY, '1').catch(() => {
      // Best-effort; a failed write just means it may show again next launch.
    });
  }, []);

  return { seen, ready, markSeen };
}
