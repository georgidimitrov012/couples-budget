import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import { DEFAULT_CURRENCY, formatMoney, isCurrency, type Currency } from '../lib/currency';

const STORAGE_KEY = 'app.currency';

type CurrencyValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** Format an amount in the active currency. */
  format: (n: number) => string;
};

// The value used when no provider is mounted — e.g. unit tests that render a
// screen bare. It resolves to EUR so the suite's `€` string assertions stay
// stable. The real app is wrapped in <CurrencyProvider>, which also defaults to
// EUR and remembers the user's choice.
const CurrencyContext = createContext<CurrencyValue>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  format: (n) => formatMoney(n, DEFAULT_CURRENCY),
});

/**
 * Provides the active display currency + a `format()` helper to the whole app.
 * The choice is device-local (persisted with expo-secure-store, best-effort) and
 * only affects rendering — amounts are always stored as plain numbers.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (active && isCurrency(stored)) setCurrencyState(stored);
      } catch {
        // No stored preference (or storage unavailable) — keep the default.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory choice still applies.
    });
  }, []);

  const value = useMemo<CurrencyValue>(
    () => ({ currency, setCurrency, format: (n) => formatMoney(n, currency) }),
    [currency, setCurrency]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
