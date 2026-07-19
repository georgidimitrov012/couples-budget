import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockStore: Record<string, string> = {};
const mockGetItem = jest.fn(async (k: string) => mockStore[k] ?? null);
const mockSetItem = jest.fn(async (k: string, v: string) => {
  mockStore[k] = v;
});
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...a: [string]) => mockGetItem(...a),
  setItemAsync: (...a: [string, string]) => mockSetItem(...a),
}));

import { TranslationProvider, useTranslation } from '../../hooks/useTranslation';

function wrapper({ children }: { children: React.ReactNode }) {
  return <TranslationProvider>{children}</TranslationProvider>;
}

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockGetItem.mockClear();
  mockSetItem.mockClear();
});

describe('useTranslation', () => {
  it('defaults to Bulgarian under the provider', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper });
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled());
    expect(result.current.lang).toBe('bg');
    expect(result.current.t('tab.budget')).toBe('Бюджет');
  });

  it('restores a persisted language on mount', async () => {
    mockStore['app.language'] = 'en';
    const { result } = await renderHook(() => useTranslation(), { wrapper });
    await waitFor(() => expect(result.current.lang).toBe('en'));
    expect(result.current.t('tab.budget')).toBe('Budget');
  });

  it('switches language and persists the choice', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper });
    await act(async () => {
      result.current.setLang('en');
    });
    expect(result.current.lang).toBe('en');
    expect(result.current.t('tab.budget')).toBe('Budget');
    expect(mockSetItem).toHaveBeenCalledWith('app.language', 'en');
  });

  it('falls back to English with no provider (test-render default)', async () => {
    const { result } = await renderHook(() => useTranslation());
    expect(result.current.lang).toBe('en');
    expect(result.current.t('tab.budget')).toBe('Budget');
  });
});
