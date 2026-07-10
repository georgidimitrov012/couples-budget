import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

const mockSignUp = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signUp: (...a: unknown[]) => mockSignUp(...a) } },
}));

import SignUpScreen from '../../src/app/(auth)/sign-up';

describe('SignUpScreen', () => {
  it('rejects a password shorter than 6 characters', async () => {
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), '123');
    await user.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText(/at least 6 characters/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('passes a trimmed email + display_name to signUp', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await user.type(screen.getByPlaceholderText('Display name'), 'Al');
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com ');
    await user.type(screen.getByPlaceholderText('Password'), 'secret1');
    await user.press(screen.getByRole('button', { name: 'Create account' }));
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret1',
      options: { data: { display_name: 'Al' } },
    });
  });

  it('shows the "check your email" state when signUp returns no session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret1');
    await user.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Check your email')).toBeTruthy();
  });
});
