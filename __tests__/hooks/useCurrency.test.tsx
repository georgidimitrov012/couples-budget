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

import { CurrencyProvider, useCurrency } from '../../hooks/useCurrency';

const NBSP = String.fromCharCode(0xa0);

function wrapper({ children }: { children: React.ReactNode }) {
  return <CurrencyProvider>{children}</CurrencyProvider>;
}

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockGetItem.mockClear();
  mockSetItem.mockClear();
});

describe('useCurrency', () => {
  it('defaults to the euro under the provider', async () => {
    const { result } = await renderHook(() => useCurrency(), { wrapper });
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled());
    expect(result.current.currency).toBe('EUR');
    expect(result.current.format(12.5)).toBe(`12.50${NBSP}€`);
  });

  it('restores a persisted currency on mount', async () => {
    mockStore['app.currency'] = 'BGN';
    const { result } = await renderHook(() => useCurrency(), { wrapper });
    await waitFor(() => expect(result.current.currency).toBe('BGN'));
    expect(result.current.format(12.5)).toBe(`12.50${NBSP}лв.`);
  });

  it('switches currency and persists the choice', async () => {
    const { result } = await renderHook(() => useCurrency(), { wrapper });
    await act(async () => {
      result.current.setCurrency('USD');
    });
    expect(result.current.currency).toBe('USD');
    expect(result.current.format(12.5)).toBe(`12.50${NBSP}$`);
    expect(mockSetItem).toHaveBeenCalledWith('app.currency', 'USD');
  });

  it('falls back to the euro with no provider (test-render default)', async () => {
    const { result } = await renderHook(() => useCurrency());
    expect(result.current.currency).toBe('EUR');
    expect(result.current.format(12.5)).toBe(`12.50${NBSP}€`);
  });
});
