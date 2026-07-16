import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockUseHousehold = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.com', user_metadata: { display_name: 'Alice' } } }),
}));
jest.mock('../../hooks/useHousehold', () => ({ useHousehold: () => mockUseHousehold() }));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signOut: (...a: unknown[]) => mockSignOut(...a) } },
}));

import HomeScreen from '../../src/app/(app)/(tabs)/index';

beforeEach(() => mockSignOut.mockResolvedValue({ error: null }));

describe('HomeScreen', () => {
  it('shows the invite code + waiting state with a single member', async () => {
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }],
    });
    await render(<HomeScreen />);
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByText(/Waiting for your partner/)).toBeTruthy();
  });

  it('shows the "both set up" state once the partner joins', async () => {
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    await render(<HomeScreen />);
    expect(screen.getByText(/both set up/)).toBeTruthy();
    expect(screen.queryByText('ABC123')).toBeNull();
  });

  it('signs out when the button is pressed', async () => {
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    await render(<HomeScreen />);
    fireEvent.press(screen.getByText('Sign out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('offers a Settings entry point', async () => {
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    await render(<HomeScreen />);
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });
});
