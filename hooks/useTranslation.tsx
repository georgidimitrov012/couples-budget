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

import { DEFAULT_LANG, isLang, translate, type Lang } from '../lib/i18n';

const STORAGE_KEY = 'app.language';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

type TranslationValue = { lang: Lang; setLang: (lang: Lang) => void; t: Translate };

// The value used when no provider is mounted — e.g. unit tests that render a
// screen bare. It resolves to English so the suite's string assertions stay
// stable. The real app is wrapped in <TranslationProvider>, which defaults to
// Bulgarian and remembers the user's choice.
const TranslationContext = createContext<TranslationValue>({
  lang: 'en',
  setLang: () => {},
  t: (key, params) => translate('en', key, params),
});

/**
 * Provides the active language + a `t()` helper to the whole app. Bulgarian is
 * the default; the choice is persisted with expo-secure-store (best-effort, so a
 * platform without it just falls back to the default each launch).
 */
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (active && isLang(stored)) setLangState(stored);
      } catch {
        // No stored preference (or storage unavailable) — keep the default.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory choice still applies.
    });
  }, []);

  const value = useMemo<TranslationValue>(
    () => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }),
    [lang, setLang]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  return useContext(TranslationContext);
}
