import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();
const insertSpy = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    channel: (...a: unknown[]) => mockChannel(...a),
    removeChannel: (...a: unknown[]) => mockRemoveChannel(...a),
  },
}));
jest.mock('../../hooks/useAuth', () => {
  const user = { id: 'u1' };
  return { useAuth: () => ({ user }) };
});
jest.mock('../../hooks/useHousehold', () => {
  const household = { id: 'h1' };
  return { useHousehold: () => ({ household }) };
});

import { useTransactions } from '../../hooks/useTransactions';

type Result = { data?: unknown; error: unknown };
const results: { select: Result; insert: Result; delete: Result } = {
  select: { data: [], error: null },
  insert: { data: null, error: null },
  delete: { error: null },
};

function makeChain() {
  const chain: Record<string, unknown> = {};
  let op: 'select' | 'insert' | 'delete' = 'select';
  chain.select = jest.fn(() => chain);
  chain.insert = jest.fn((...a: unknown[]) => {
    insertSpy(...a);
    op = 'insert';
    return chain;
  });
  chain.delete = jest.fn(() => {
    op = 'delete';
    return chain;
  });
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(results.insert));
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(op === 'delete' ? results.delete : results.select).then(res, rej);
  return chain;
}

let rtHandler: (payload: unknown) => void = () => {};

function tx(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    household_id: 'h1',
    category_id: null,
    owner_id: 'u1',
    amount: 10,
    description: 'Groceries',
    occurred_on: '2026-07-01',
    scope: 'shared',
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  results.select = { data: [], error: null };
  results.insert = { data: null, error: null };
  results.delete = { error: null };
  insertSpy.mockClear();
  mockFrom.mockImplementation(() => makeChain());
  mockChannel.mockImplementation(() => {
    const ch: Record<string, unknown> = {};
    ch.on = jest.fn((_e: unknown, _f: unknown, handler: (p: unknown) => void) => {
      rtHandler = handler;
      return ch;
    });
    ch.subscribe = jest.fn(() => ch);
    return ch;
  });
});

describe('useTransactions', () => {
  it('loads transactions newest-first', async () => {
    results.select = {
      data: [
        tx({ id: 't1', occurred_on: '2026-07-01' }),
        tx({ id: 't2', occurred_on: '2026-07-05' }),
      ],
      error: null,
    };
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('adds optimistically then reconciles to the inserted row', async () => {
    results.insert = { data: tx({ id: 'real1', description: 'Coffee', amount: 5 }), error: null };
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addTransaction({ amount: 5, description: 'Coffee', scope: 'shared' });
    });
    expect(result.current.items.some((t) => t.id === 'real1')).toBe(true);
    expect(result.current.items.every((t) => !t.id.startsWith('temp-'))).toBe(true);
  });

  it('rolls back and surfaces the error when the insert fails', async () => {
    results.insert = { data: null, error: { message: 'insert denied' } };
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addTransaction({ amount: 5, scope: 'private' });
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBe('insert denied');
  });

  it('ignores a non-positive amount (no insert)', async () => {
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addTransaction({ amount: 0, scope: 'shared' });
    });
    expect(insertSpy).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
  });

  it('removes a transaction', async () => {
    results.select = { data: [tx({ id: 't1' })], error: null };
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeTransaction(result.current.items[0]);
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('merges realtime INSERT and DELETE events', async () => {
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      rtHandler({ eventType: 'INSERT', new: tx({ id: 'rt1', scope: 'shared' }) });
    });
    expect(result.current.items.some((t) => t.id === 'rt1')).toBe(true);

    await act(async () => {
      rtHandler({ eventType: 'DELETE', old: { id: 'rt1' } });
    });
    expect(result.current.items.some((t) => t.id === 'rt1')).toBe(false);
  });

  it("defensively drops a realtime private row owned by the partner (Yours stays hidden)", async () => {
    const { result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      rtHandler({ eventType: 'INSERT', new: tx({ id: 'partner', scope: 'private', owner_id: 'u2' }) });
      rtHandler({ eventType: 'INSERT', new: tx({ id: 'mine', scope: 'private', owner_id: 'u1' }) });
    });
    expect(result.current.items.some((t) => t.id === 'partner')).toBe(false);
    expect(result.current.items.some((t) => t.id === 'mine')).toBe(true);
  });

  it('removes the realtime channel on unmount', async () => {
    const { unmount, result } = await renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
