import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));

import { supabase } from '../../lib/supabase';
import { AuthProvider, useAuth } from '../../hooks/useAuth';
import { expectHookToThrow } from '../../test/expectHookToThrow';

const auth = supabase.auth as unknown as { getSession: jest.Mock; onAuthStateChange: jest.Mock };
const unsubscribe = jest.fn();
let authCallback: (event: string, session: unknown) => void = () => {};

beforeEach(() => {
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockImplementation((cb: typeof authCallback) => {
    authCallback = cb;
    return { data: { subscription: { unsubscribe } } };
  });
});

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('useAuth', () => {
  it('restores "no session" and finishes initializing', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('restores a persisted session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user).toEqual({ id: 'u1' });
  });

  it('updates the session on an auth-state change', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await act(async () => authCallback('SIGNED_IN', { user: { id: 'u2' } }));
    expect(result.current.user).toEqual({ id: 'u2' });
    await act(async () => authCallback('SIGNED_OUT', null));
    expect(result.current.session).toBeNull();
  });

  it('unsubscribes from auth events on unmount', async () => {
    const { unmount, result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('throws when used outside an AuthProvider', async () => {
    await expectHookToThrow(() => useAuth(), /AuthProvider/);
  });
});
