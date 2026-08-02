import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const insertSpy = jest.fn();
const deleteEqSpy = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
jest.mock('../../hooks/useAuth', () => {
  const user = { id: 'u1' };
  return { useAuth: () => ({ user }) };
});
jest.mock('../../hooks/useHousehold', () => {
  const household = { id: 'h1' };
  return { useHousehold: () => ({ household }) };
});

import { useRecurringRules } from '../../hooks/useRecurringRules';

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
  chain.eq = jest.fn((...a: unknown[]) => {
    if (op === 'delete') deleteEqSpy(...a);
    return chain;
  });
  chain.order = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(results.insert));
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(op === 'delete' ? results.delete : results.select).then(res, rej);
  return chain;
}

function rule(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    household_id: 'h1',
    owner_id: 'u1',
    category_id: null,
    amount: 900,
    description: 'Rent',
    scope: 'shared',
    day_of_month: 1,
    last_charged_month: null,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  results.select = { data: [], error: null };
  results.insert = { data: null, error: null };
  results.delete = { error: null };
  insertSpy.mockClear();
  deleteEqSpy.mockClear();
  mockFrom.mockImplementation(() => makeChain());
});

describe('useRecurringRules', () => {
  it('loads the caller’s rules oldest-first', async () => {
    results.select = {
      data: [
        rule({ id: 'r2', created_at: '2026-07-05T00:00:00Z' }),
        rule({ id: 'r1', created_at: '2026-07-01T00:00:00Z' }),
      ],
      error: null,
    };
    const { result } = await renderHook(() => useRecurringRules());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rules.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('adds a rule and appends it to the list', async () => {
    results.insert = { data: rule({ id: 'real1', description: 'Netflix', amount: 15 }), error: null };
    const { result } = await renderHook(() => useRecurringRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: 'unset' };
    await act(async () => {
      res = await result.current.addRule({
        amount: 15,
        description: 'Netflix',
        scope: 'shared',
        dayOfMonth: 5,
      });
    });
    expect(res.error).toBeNull();
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15, description: 'Netflix', day_of_month: 5, owner_id: 'u1' })
    );
    expect(result.current.rules.some((r) => r.id === 'real1')).toBe(true);
  });

  it('clamps an out-of-range day of month on insert', async () => {
    results.insert = { data: rule({ id: 'real1' }), error: null };
    const { result } = await renderHook(() => useRecurringRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addRule({ amount: 10, scope: 'private', dayOfMonth: 99 });
    });
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ day_of_month: 28 }));
  });

  it('rejects a non-positive amount without inserting', async () => {
    const { result } = await renderHook(() => useRecurringRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.addRule({ amount: 0, scope: 'shared', dayOfMonth: 1 });
    });
    expect(res.error).toBeTruthy();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('removes a rule optimistically', async () => {
    results.select = { data: [rule({ id: 'r1' })], error: null };
    const { result } = await renderHook(() => useRecurringRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeRule(result.current.rules[0]);
    });
    expect(result.current.rules).toHaveLength(0);
    expect(deleteEqSpy).toHaveBeenCalledWith('id', 'r1');
  });

  it('restores the rule and surfaces the error when a delete fails', async () => {
    results.select = { data: [rule({ id: 'r1' })], error: null };
    results.delete = { error: { message: 'delete denied' } };
    const { result } = await renderHook(() => useRecurringRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeRule(result.current.rules[0]);
    });
    expect(result.current.rules.some((r) => r.id === 'r1')).toBe(true);
    expect(result.current.error).toBe('delete denied');
  });
});
