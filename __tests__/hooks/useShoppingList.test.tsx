import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const insertSpy = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

// Mutable, referentially-stable household mock (same shape as the real context).
const householdMock: { household: { id: string } | null } = { household: { id: 'h1' } };
jest.mock('../../hooks/useHousehold', () => ({ useHousehold: () => householdMock }));

import { useShoppingList } from '../../hooks/useShoppingList';

const results = {
  select: { data: [] as unknown, error: null as unknown },
  insert: { data: null as unknown, error: null as unknown },
};

// select('id').eq().order().limit() is awaited; insert().select().single() ends in single().
function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.insert = jest.fn((...a: unknown[]) => {
    insertSpy(...a);
    return chain;
  });
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(results.insert));
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(results.select).then(res, rej);
  return chain;
}

beforeEach(() => {
  householdMock.household = { id: 'h1' };
  results.select = { data: [], error: null };
  results.insert = { data: null, error: null };
  insertSpy.mockClear();
  mockFrom.mockImplementation(() => makeChain());
});

describe('useShoppingList', () => {
  it('returns the existing list without creating one', async () => {
    results.select = { data: [{ id: 'L1' }], error: null };
    const { result } = await renderHook(() => useShoppingList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.listId).toBe('L1');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('creates the default list when none exists', async () => {
    results.select = { data: [], error: null };
    results.insert = { data: { id: 'L2' }, error: null };
    const { result } = await renderHook(() => useShoppingList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(insertSpy).toHaveBeenCalledWith({ household_id: 'h1' });
    expect(result.current.listId).toBe('L2');
  });

  it('surfaces a select error and leaves listId null', async () => {
    results.select = { data: null, error: { message: 'boom' } };
    const { result } = await renderHook(() => useShoppingList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.listId).toBeNull();
  });

  it('does not query when there is no household yet', async () => {
    householdMock.household = null;
    const { result } = await renderHook(() => useShoppingList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.listId).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retry() re-runs the resolution after a failure', async () => {
    results.select = { data: null, error: { message: 'boom' } };
    const { result } = await renderHook(() => useShoppingList());
    await waitFor(() => expect(result.current.error).toBe('boom'));

    results.select = { data: [{ id: 'L1' }], error: null };
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.listId).toBe('L1'));
    expect(result.current.error).toBeNull();
  });
});
