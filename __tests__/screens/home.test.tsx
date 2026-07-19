import React from 'react';
import { render, screen, fireEvent, userEvent, waitFor } from '@testing-library/react-native';

const mockUseHousehold = jest.fn();
const mockSignOut = jest.fn();
const mockUseIntroSeen = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.com', user_metadata: { display_name: 'Alice' } } }),
}));
jest.mock('../../hooks/useHousehold', () => ({ useHousehold: () => mockUseHousehold() }));
jest.mock('../../hooks/useIntroSeen', () => ({ useIntroSeen: () => mockUseIntroSeen() }));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signOut: (...a: unknown[]) => mockSignOut(...a) } },
}));

import HomeScreen from '../../src/app/(app)/(tabs)/index';

beforeEach(() => {
  mockSignOut.mockResolvedValue({ error: null });
  mockPush.mockClear();
  // Intro already dismissed by default so it doesn't overlay the other tests.
  mockUseIntroSeen.mockReturnValue({ seen: true, ready: true, markSeen: jest.fn() });
});

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

  it('shows next-step cards once the partner joins', async () => {
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    await render(<HomeScreen />);
    expect(screen.getByText('Start your shopping list')).toBeTruthy();
    expect(screen.getByText('Log your first expense')).toBeTruthy();
    expect(screen.queryByText('ABC123')).toBeNull();
  });

  it('deep-links to a tab from a next-step card', async () => {
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    const user = userEvent.setup();
    await render(<HomeScreen />);
    await user.press(screen.getByLabelText('Start your shopping list'));
    expect(mockPush).toHaveBeenCalledWith('/list');
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

  it('regenerates the invite code from the waiting state', async () => {
    const regenerateInviteCode = jest.fn().mockResolvedValue({ error: null });
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABCD2345' },
      members: [{ user_id: 'u1' }],
      regenerateInviteCode,
    });
    const user = userEvent.setup();
    await render(<HomeScreen />);
    await user.press(screen.getByLabelText('Regenerate code'));
    await waitFor(() => expect(regenerateInviteCode).toHaveBeenCalled());
  });

  it('shows the first-run explainer and dismisses it', async () => {
    const markSeen = jest.fn();
    mockUseIntroSeen.mockReturnValue({ seen: false, ready: true, markSeen });
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    const user = userEvent.setup();
    await render(<HomeScreen />);
    expect(screen.getByText('How this works')).toBeTruthy();
    await user.press(screen.getByLabelText('Got it'));
    expect(markSeen).toHaveBeenCalled();
  });

  it('does not show the explainer once it has been seen', async () => {
    mockUseIntroSeen.mockReturnValue({ seen: true, ready: true, markSeen: jest.fn() });
    mockUseHousehold.mockReturnValue({
      household: { name: 'Our Home', invite_code: 'ABC123' },
      members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    });
    await render(<HomeScreen />);
    expect(screen.queryByText('How this works')).toBeNull();
  });
});
