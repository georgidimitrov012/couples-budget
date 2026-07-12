import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const insertSpy = jest.fn();

jest.mock('../../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
jest.mock('../../hooks/useAuth', () => {
  const user = { id: 'u1' };
  return { useAuth: () => ({ user }) };
});
jest.mock('../../hooks/useHousehold', () => {
  const household = { id: 'h1' };
  return { useHousehold: () => ({ household }) };
});

import { CategoriesProvider, useCategories } from '../../hooks/useCategories';
import { expectHookToThrow } from '../../test/expectHookToThrow';

type Result = { data?: unknown; error: unknown };
const results: { select: Result; insert: Result; update: Result; delete: Result } = {
  select: { data: [], error: null },
  insert: { data: null, error: null },
  update: { error: null },
  delete: { error: null },
};
const updateSpy = jest.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  chain.select = jest.fn(() => chain);
  chain.insert = jest.fn((...a: unknown[]) => {
    insertSpy(...a);
    op = 'insert';
    return chain;
  });
  chain.update = jest.fn((...a: unknown[]) => {
    updateSpy(...a);
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
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(
      op === 'delete' ? results.delete : op === 'update' ? results.update : results.select
    ).then(res, rej);
  return chain;
}

function cat(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    household_id: 'h1',
    owner_id: 'u1',
    name: 'Food',
    color: '#3c87f7',
    scope: 'shared',
    monthly_limit: null,
    ...over,
  };
}

beforeEach(() => {
  results.select = { data: [], error: null };
  results.insert = { data: null, error: null };
  results.update = { error: null };
  results.delete = { error: null };
  insertSpy.mockClear();
  updateSpy.mockClear();
  mockFrom.mockImplementation(() => makeChain());
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CategoriesProvider>{children}</CategoriesProvider>
);

describe('useCategories', () => {
  it('loads the household categories', async () => {
    results.select = {
      data: [cat({ id: 'c1', name: 'Food' }), cat({ id: 'c2', name: 'Rent' })],
      error: null,
    };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories.map((c) => c.name)).toEqual(['Food', 'Rent']);
  });

  it('addCategory inserts and keeps the list sorted by name', async () => {
    results.select = { data: [cat({ id: 'c1', name: 'Food' })], error: null };
    results.insert = { data: cat({ id: 'c3', name: 'Bills', scope: 'shared' }), error: null };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: 'unset' };
    await act(async () => {
      res = await result.current.addCategory({ name: 'Bills', color: '#fff', scope: 'shared' });
    });
    expect(res.error).toBeNull();
    expect(result.current.categories.map((c) => c.name)).toEqual(['Bills', 'Food']);
  });

  it('addCategory forwards the monthly limit', async () => {
    results.insert = { data: cat({ id: 'c3', name: 'Bills', monthly_limit: 200 }), error: null };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addCategory({ name: 'Bills', scope: 'shared', monthlyLimit: 200 });
    });
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ monthly_limit: 200 }));
  });

  it('updateCategory sets the limit optimistically', async () => {
    results.select = { data: [cat({ id: 'c1', name: 'Food', monthly_limit: null })], error: null };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateCategory(result.current.categories[0], { monthlyLimit: 80 });
    });
    expect(updateSpy).toHaveBeenCalledWith({ monthly_limit: 80 });
    expect(result.current.categories[0].monthly_limit).toBe(80);
  });

  it('updateCategory restores the previous value on error', async () => {
    results.select = { data: [cat({ id: 'c1', name: 'Food', monthly_limit: 50 })], error: null };
    results.update = { error: { message: 'denied' } };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.updateCategory(result.current.categories[0], { monthlyLimit: 99 });
    });
    expect(res.error).toBe('denied');
    expect(result.current.categories[0].monthly_limit).toBe(50);
  });

  it('addCategory rejects an empty name without hitting the DB', async () => {
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.addCategory({ name: '   ', scope: 'shared' });
    });
    expect(res.error).toMatch(/name/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('addCategory surfaces an insert error', async () => {
    results.insert = { data: null, error: { message: 'denied' } };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.addCategory({ name: 'X', scope: 'private' });
    });
    expect(res.error).toBe('denied');
  });

  it('removeCategory drops it optimistically', async () => {
    results.select = { data: [cat({ id: 'c1', name: 'Food' })], error: null };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeCategory(result.current.categories[0]);
    });
    expect(result.current.categories).toHaveLength(0);
  });

  it('removeCategory restores the item and reports the error on failure', async () => {
    results.select = { data: [cat({ id: 'c1', name: 'Food' })], error: null };
    results.delete = { error: { message: 'cannot delete' } };
    const { result } = await renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.removeCategory(result.current.categories[0]);
    });
    expect(res.error).toBe('cannot delete');
    expect(result.current.categories).toHaveLength(1);
  });

  it('throws when used outside a CategoriesProvider', async () => {
    await expectHookToThrow(() => useCategories(), /CategoriesProvider/);
  });
});
