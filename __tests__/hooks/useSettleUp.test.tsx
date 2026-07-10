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
  const members = [
    { user_id: 'u1', role: 'owner', joined_at: '', display_name: 'Alex' },
    { user_id: 'u2', role: 'member', joined_at: '', display_name: 'Maria' },
  ];
  return { useHousehold: () => ({ household, members }) };
});

import { useSettleUp, type Settlement } from '../../hooks/useSettleUp';
import type { Transaction } from '../../hooks/useTransactions';

type Result = { data?: unknown; error: unknown };
const results: { select: Result; insert: Result } = {
  select: { data: [], error: null },
  insert: { data: null, error: null },
};

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.insert = jest.fn((...a: unknown[]) => {
    insertSpy(...a);
    return chain;
  });
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(results.insert));
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(results.select).then(res, rej);
  return chain;
}

let rtHandler: (payload: unknown) => void = () => {};

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: `t-${Math.random()}`,
    household_id: 'h1',
    category_id: null,
    list_item_id: null,
    owner_id: 'u1',
    amount: 10,
    description: null,
    occurred_on: '2026-07-01',
    scope: 'shared',
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

function settlement(over: Partial<Settlement> = {}): Settlement {
  return {
    id: 's1',
    household_id: 'h1',
    from_user: 'u2',
    to_user: 'u1',
    amount: 20,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  results.select = { data: [], error: null };
  results.insert = { data: null, error: null };
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

async function renderSettle(transactions: Transaction[]) {
  const rendered = await renderHook(({ txs }: { txs: Transaction[] }) => useSettleUp(txs), {
    initialProps: { txs: transactions },
  });
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
}

describe('useSettleUp', () => {
  it('is all square with no shared expenses and no settlements', async () => {
    const { result } = await renderSettle([]);
    expect(result.current.balance).toBe(0);
  });

  it('splits shared expenses 50/50: each partner owes half of what the other paid', async () => {
    const { result } = await renderSettle([
      tx({ owner_id: 'u1', amount: 100 }), // Maria owes me 50
      tx({ owner_id: 'u2', amount: 60 }), // I owe Maria 30
    ]);
    expect(result.current.balance).toBe(20);
  });

  it('ignores private ("Mine") expenses entirely', async () => {
    const { result } = await renderSettle([
      tx({ owner_id: 'u1', amount: 100 }),
      tx({ owner_id: 'u2', amount: 60 }),
      tx({ owner_id: 'u1', amount: 500, scope: 'private' }),
    ]);
    expect(result.current.balance).toBe(20);
  });

  it('recorded settlements cancel the debt', async () => {
    results.select = { data: [settlement({ from_user: 'u2', to_user: 'u1', amount: 20 })], error: null };
    const { result } = await renderSettle([
      tx({ owner_id: 'u1', amount: 100 }),
      tx({ owner_id: 'u2', amount: 60 }),
    ]);
    expect(result.current.balance).toBe(0);
    expect(result.current.lastSettledOn).toBe('2026-07-01');
  });

  it('settleUp records debtor → creditor for the full balance (partner owes me)', async () => {
    results.insert = {
      data: settlement({ id: 'new1', from_user: 'u2', to_user: 'u1', amount: 20 }),
      error: null,
    };
    const { result } = await renderSettle([
      tx({ owner_id: 'u1', amount: 100 }),
      tx({ owner_id: 'u2', amount: 60 }),
    ]);

    await act(async () => {
      await result.current.settleUp();
    });
    expect(insertSpy).toHaveBeenCalledWith({
      household_id: 'h1',
      from_user: 'u2',
      to_user: 'u1',
      amount: 20,
    });
    expect(result.current.balance).toBe(0);
  });

  it('settleUp flips direction when I am the debtor', async () => {
    results.insert = {
      data: settlement({ id: 'new1', from_user: 'u1', to_user: 'u2', amount: 30 }),
      error: null,
    };
    const { result } = await renderSettle([tx({ owner_id: 'u2', amount: 60 })]);
    expect(result.current.balance).toBe(-30);

    await act(async () => {
      await result.current.settleUp();
    });
    expect(insertSpy).toHaveBeenCalledWith({
      household_id: 'h1',
      from_user: 'u1',
      to_user: 'u2',
      amount: 30,
    });
    expect(result.current.balance).toBe(0);
  });

  it('settleUp is a no-op when already square', async () => {
    const { result } = await renderSettle([]);
    await act(async () => {
      await result.current.settleUp();
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('surfaces an insert error without recording anything', async () => {
    results.insert = { data: null, error: { message: 'insert denied' } };
    const { result } = await renderSettle([tx({ owner_id: 'u1', amount: 100 })]);

    await act(async () => {
      await result.current.settleUp();
    });
    expect(result.current.error).toBe('insert denied');
    expect(result.current.balance).toBe(50); // unchanged
  });

  it("merges the partner's realtime settlement into the balance", async () => {
    const { result } = await renderSettle([tx({ owner_id: 'u1', amount: 100 })]);
    expect(result.current.balance).toBe(50);

    await act(async () => {
      rtHandler({
        eventType: 'INSERT',
        new: settlement({ id: 'rt1', from_user: 'u2', to_user: 'u1', amount: 50 }),
      });
    });
    expect(result.current.balance).toBe(0);
  });

  it('retry() reloads after a failed load and clears the error', async () => {
    results.select = { data: null, error: { message: 'load failed' } };
    const { result } = await renderSettle([]);
    expect(result.current.error).toBe('load failed');

    results.select = { data: [settlement()], error: null };
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.settlements).toHaveLength(1);
  });

  it('removes the realtime channel on unmount', async () => {
    const { unmount } = await renderSettle([]);
    await unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
