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

import { useListItems } from '../../hooks/useListItems';

type Result = { data?: unknown; error: unknown };
const results: { select: Result; insert: Result; update: Result; delete: Result } = {
  select: { data: [], error: null },
  insert: { data: null, error: null },
  update: { error: null },
  delete: { error: null },
};

// Chainable builder: insert terminates in .single(); select/update/delete are
// awaited thenables that resolve to the matching preset result.
function makeChain() {
  const chain: Record<string, unknown> = {};
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  chain.select = jest.fn(() => chain);
  chain.insert = jest.fn((...a: unknown[]) => {
    op = 'insert';
    insertSpy(...a);
    return chain;
  });
  chain.update = jest.fn(() => {
    op = 'update';
    return chain;
  });
  chain.delete = jest.fn(() => {
    op = 'delete';
    return chain;
  });
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(results.insert));
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    const r =
      op === 'update' ? results.update : op === 'delete' ? results.delete : results.select;
    return Promise.resolve(r).then(res, rej);
  };
  return chain;
}

let rtHandler: (payload: unknown) => void = () => {};

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    list_id: 'L1',
    name: 'Milk',
    quantity: 1,
    category: 'dairy',
    is_checked: false,
    added_by: 'u1',
    checked_by: null,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2020-01-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  results.select = { data: [], error: null };
  results.insert = { data: null, error: null };
  results.update = { error: null };
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

describe('useListItems', () => {
  it('loads items ordered for the list', async () => {
    results.select = {
      data: [
        row({ id: 'i1', name: 'Milk' }),
        row({ id: 'i2', name: 'Eggs', created_at: '2020-01-02T00:00:00Z' }),
      ],
      error: null,
    };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.name)).toEqual(['Milk', 'Eggs']);
  });

  it('does nothing (no subscription) when listId is null', async () => {
    await renderHook(() => useListItems(null));
    expect(mockChannel).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('adds optimistically with its category, then reconciles to the inserted row', async () => {
    results.insert = { data: row({ id: 'real1', name: 'Bread', category: 'bakery' }), error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addItem('Bread', { category: 'bakery' });
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bread', quantity: 1, category: 'bakery' })
    );
    expect(result.current.items.some((i) => i.id === 'real1' && i.name === 'Bread')).toBe(true);
    expect(result.current.items.every((i) => !i.id.startsWith('temp-'))).toBe(true);
  });

  it('rolls back and surfaces the error when the insert fails', async () => {
    results.insert = { data: null, error: { message: 'insert denied' } };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addItem('Bread');
    });
    expect(result.current.items.find((i) => i.name === 'Bread')).toBeFalsy();
    expect(result.current.error).toBe('insert denied');
  });

  it('toggles an item checked (and records who checked it) without touching the budget', async () => {
    results.select = { data: [row({ id: 'i1', name: 'Milk', is_checked: false })], error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleItem(result.current.items[0]);
    });
    expect(result.current.items[0].is_checked).toBe(true);
    expect(result.current.items[0].checked_by).toBe('u1');
    // Only the list_items table is ever touched now — no transactions.
    expect(mockFrom.mock.calls.every((c) => c[0] === 'list_items')).toBe(true);
  });

  it('setQuantity updates the quantity (and clamps at 1)', async () => {
    results.select = { data: [row({ id: 'i1', quantity: 2 })], error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setQuantity(result.current.items[0], 5);
    });
    expect(result.current.items[0].quantity).toBe(5);

    await act(async () => {
      await result.current.setQuantity(result.current.items[0], 0);
    });
    expect(result.current.items[0].quantity).toBe(1);
  });

  it('adds an item pre-checked (an off-list purchase logged from the budget)', async () => {
    results.insert = {
      data: row({ id: 'real1', name: 'Cookies', is_checked: true, checked_by: 'u1' }),
      error: null,
    };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addItem('Cookies', { checked: true });
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cookies', is_checked: true, checked_by: 'u1' })
    );
    expect(result.current.items.some((i) => i.id === 'real1' && i.is_checked)).toBe(true);
  });

  it('completeItem checks the item off when the full quantity is bought', async () => {
    results.select = { data: [row({ id: 'i1', quantity: 2, is_checked: false })], error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.completeItem(result.current.items[0], 2);
    });
    expect(result.current.items[0].is_checked).toBe(true);
    expect(result.current.items[0].checked_by).toBe('u1');
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('completeItem leaves the remainder on the list when fewer are bought', async () => {
    results.select = { data: [row({ id: 'i1', quantity: 3, is_checked: false })], error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.completeItem(result.current.items[0], 1);
    });
    expect(result.current.items[0].is_checked).toBe(false);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('completeItem ignores a non-positive quantity', async () => {
    results.select = { data: [row({ id: 'i1', quantity: 2, is_checked: false })], error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.completeItem(result.current.items[0], 0);
    });
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.items[0].is_checked).toBe(false);
  });

  it('removes an item', async () => {
    results.select = { data: [row({ id: 'i1' })], error: null };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeItem(result.current.items[0]);
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('clears only the checked items', async () => {
    results.select = {
      data: [
        row({ id: 'i1', name: 'Milk', is_checked: true }),
        row({ id: 'i2', name: 'Eggs', is_checked: false, created_at: '2020-01-02T00:00:00Z' }),
      ],
      error: null,
    };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.clearChecked();
    });
    expect(result.current.items.map((i) => i.id)).toEqual(['i2']);
  });

  it('merges realtime INSERT and DELETE events (partner edits)', async () => {
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      rtHandler({ eventType: 'INSERT', new: row({ id: 'rt1', name: 'Butter' }) });
    });
    expect(result.current.items.some((i) => i.id === 'rt1')).toBe(true);

    await act(async () => {
      rtHandler({ eventType: 'DELETE', old: { id: 'rt1' } });
    });
    expect(result.current.items.some((i) => i.id === 'rt1')).toBe(false);
  });

  it('removes the realtime channel on unmount', async () => {
    const { unmount, result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('retry() reloads after a failed load and clears the error', async () => {
    results.select = { data: null, error: { message: 'load failed' } };
    const { result } = await renderHook(() => useListItems('L1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('load failed');

    results.select = { data: [row({ id: 'i1' })], error: null };
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.items).toHaveLength(1);
  });
});
