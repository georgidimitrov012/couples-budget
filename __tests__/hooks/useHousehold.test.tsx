import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
    channel: (...a: unknown[]) => mockChannel(...a),
    removeChannel: (...a: unknown[]) => mockRemoveChannel(...a),
  },
}));
// Stable user reference (as it would be from context) so the load effect,
// which depends on `user`, doesn't re-run every render.
jest.mock('../../hooks/useAuth', () => {
  const user = { id: 'u1' };
  return { useAuth: () => ({ user }) };
});

import { HouseholdProvider, useHousehold } from '../../hooks/useHousehold';
import { expectHookToThrow } from '../../test/expectHookToThrow';

// Chainable query-builder mock: select/eq/order/in/limit return the chain; the
// chain is awaitable and maybeSingle() resolves to the table's preset result.
const tableResults: Record<string, { data: unknown; error: unknown }> = {};
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'in', 'limit']) chain[m] = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return chain;
}

let rtHandler: () => void = () => {};

beforeEach(() => {
  tableResults.households = {
    data: { id: 'h1', name: 'Home', invite_code: 'ABC123', created_by: 'u1', created_at: 't0' },
    error: null,
  };
  tableResults.household_members = {
    data: [
      { user_id: 'u1', role: 'owner', joined_at: 't1' },
      { user_id: 'u2', role: 'member', joined_at: 't2' },
    ],
    error: null,
  };
  tableResults.profiles = {
    data: [
      { id: 'u1', display_name: 'Alice' },
      { id: 'u2', display_name: 'Bob' },
    ],
    error: null,
  };
  mockFrom.mockImplementation((table: string) => makeChain(tableResults[table] ?? { data: null, error: null }));
  mockChannel.mockImplementation(() => {
    const ch: Record<string, unknown> = {};
    ch.on = jest.fn((_evt: unknown, _filter: unknown, handler: () => void) => {
      rtHandler = handler;
      return ch;
    });
    ch.subscribe = jest.fn(() => ch);
    return ch;
  });
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HouseholdProvider>{children}</HouseholdProvider>
);

describe('useHousehold', () => {
  it('loads the household and merges member display names', async () => {
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.household?.id).toBe('h1');
    expect(result.current.members).toEqual([
      { user_id: 'u1', role: 'owner', joined_at: 't1', display_name: 'Alice' },
      { user_id: 'u2', role: 'member', joined_at: 't2', display_name: 'Bob' },
    ]);
  });

  it('createHousehold calls the RPC and sets the household', async () => {
    mockRpc.mockResolvedValue({
      data: { id: 'h2', name: 'New', invite_code: 'ZZZ999', created_by: 'u1', created_at: 't' },
      error: null,
    });
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let res: { error: string | null } = { error: 'unset' };
    await act(async () => {
      res = await result.current.createHousehold('New');
    });
    expect(mockRpc).toHaveBeenCalledWith('create_household', { p_name: 'New' });
    expect(res.error).toBeNull();
    expect(result.current.household?.id).toBe('h2');
  });

  it('joinHousehold surfaces the RPC error message', async () => {
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockRpc.mockResolvedValue({ data: null, error: { message: 'This household is already full' } });
    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.joinHousehold('ABC123');
    });
    expect(mockRpc).toHaveBeenCalledWith('join_household', { p_code: 'ABC123' });
    expect(res.error).toBe('This household is already full');
  });

  it('leaveHousehold calls the RPC and clears the household', async () => {
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.household?.id).toBe('h1');

    mockRpc.mockResolvedValue({ data: null, error: null });
    let res: { error: string | null } = { error: 'unset' };
    await act(async () => {
      res = await result.current.leaveHousehold();
    });
    expect(mockRpc).toHaveBeenCalledWith('leave_household');
    expect(res.error).toBeNull();
    expect(result.current.household).toBeNull();
    expect(result.current.members).toEqual([]);
  });

  it('leaveHousehold surfaces the RPC error and keeps the household', async () => {
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockRpc.mockResolvedValue({ data: null, error: { message: 'nope' } });
    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.leaveHousehold();
    });
    expect(res.error).toBe('nope');
    expect(result.current.household?.id).toBe('h1');
  });

  it('regenerateInviteCode calls the RPC and swaps in the new code', async () => {
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.household?.invite_code).toBe('ABC123');

    mockRpc.mockResolvedValue({
      data: { id: 'h1', name: 'Home', invite_code: 'WXYZ2345', created_by: 'u1', created_at: 't0' },
      error: null,
    });
    let res: { error: string | null } = { error: 'unset' };
    await act(async () => {
      res = await result.current.regenerateInviteCode();
    });
    expect(mockRpc).toHaveBeenCalledWith('regenerate_invite_code');
    expect(res.error).toBeNull();
    expect(result.current.household?.invite_code).toBe('WXYZ2345');
  });

  it('subscribes to household_members realtime and reloads members on an event', async () => {
    const { result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockChannel).toHaveBeenCalledWith('household:h1');

    const callsBefore = mockFrom.mock.calls.filter((c) => c[0] === 'household_members').length;
    await act(async () => {
      rtHandler();
      await Promise.resolve();
    });
    const callsAfter = mockFrom.mock.calls.filter((c) => c[0] === 'household_members').length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('removes the realtime channel on unmount', async () => {
    const { unmount, result } = await renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('throws when used outside a HouseholdProvider', async () => {
    await expectHookToThrow(() => useHousehold(), /HouseholdProvider/);
  });
});
