import { renderHook, act } from '@testing-library/react-native';

const mockRpc = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { signOut: (...a: unknown[]) => mockSignOut(...a) },
  },
}));

import { useAccount } from '../../hooks/useAccount';

beforeEach(() => {
  mockRpc.mockReset();
  mockSignOut.mockReset().mockResolvedValue({ error: null });
});

describe('useAccount', () => {
  it('deleteAccount calls the RPC then signs out locally', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { result } = await renderHook(() => useAccount());

    let res: { error: string | null } = { error: 'unset' };
    await act(async () => {
      res = await result.current.deleteAccount();
    });

    expect(mockRpc).toHaveBeenCalledWith('delete_account');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(res.error).toBeNull();
  });

  it('deleteAccount surfaces the RPC error and does not sign out', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = await renderHook(() => useAccount());

    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.deleteAccount();
    });

    expect(res.error).toBe('boom');
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
