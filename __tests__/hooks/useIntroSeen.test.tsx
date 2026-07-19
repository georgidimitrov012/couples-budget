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

import { useIntroSeen } from '../../hooks/useIntroSeen';

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockGetItem.mockClear();
  mockSetItem.mockClear();
});

describe('useIntroSeen', () => {
  it('reports not-seen on a fresh install once ready', async () => {
    const { result } = await renderHook(() => useIntroSeen());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.seen).toBe(false);
  });

  it('reports seen when the flag is stored', async () => {
    mockStore['intro.seen.v1'] = '1';
    const { result } = await renderHook(() => useIntroSeen());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.seen).toBe(true);
  });

  it('markSeen persists the flag and flips seen', async () => {
    const { result } = await renderHook(() => useIntroSeen());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      result.current.markSeen();
    });
    expect(result.current.seen).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith('intro.seen.v1', '1');
  });
});
