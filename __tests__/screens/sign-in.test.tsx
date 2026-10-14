import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

const mockSignIn = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) } },
}));

import SignInScreen from '../../src/app/(auth)/sign-in';

// The first render in a file is slow under a parallel or coverage run.
jest.setTimeout(30000);

beforeEach(() => mockSignIn.mockResolvedValue({ error: null }));

describe('SignInScreen', () => {
  it('shows a validation error when fields are empty', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.press(screen.getByText('Sign in'));
    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed email + password', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com ');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.press(screen.getByText('Sign in'));
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
  });

  it('shows a friendly, translated message for a Supabase error', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.press(screen.getByText('Sign in'));
    expect(await screen.findByText('Wrong email or password.')).toBeTruthy();
  });

  it('lowercases the email (Supabase emails are case-insensitive)', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'Georgi@Mail.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.press(screen.getByText('Sign in'));
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'georgi@mail.com', password: 'secret' });
  });

  it('links to password reset', async () => {
    await render(<SignInScreen />);
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('treats a whitespace-only email as empty', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByPlaceholderText('Email'), '   ');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.press(screen.getByText('Sign in'));
    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: 'over_request_rate_limit', message: 'Request rate limit reached' }, /Too many attempts/],
    [{ message: 'Network request failed' }, /No connection/],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, /Confirm your email first/],
  ])('explains %j in plain words', async (error, text) => {
    mockSignIn.mockResolvedValue({ error });
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.press(screen.getByText('Sign in'));
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('ignores a second tap while signing in', async () => {
    let finish: (v: unknown) => void = () => {};
    mockSignIn.mockReturnValue(new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.press(screen.getByText('Sign in'));
    await user.press(screen.getByRole('button', { name: '' }));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    finish({ error: null });
  });
});
