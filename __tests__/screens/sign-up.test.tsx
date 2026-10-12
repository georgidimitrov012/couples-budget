import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

const mockSignUp = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signUp: (...a: unknown[]) => mockSignUp(...a) } },
}));

import SignUpScreen from '../../src/app/(auth)/sign-up';

beforeEach(() => mockSignUp.mockReset());

type Form = { name?: string; email?: string; password?: string; confirm?: string };

async function submit(user: ReturnType<typeof userEvent.setup>, f: Form) {
  const fields: [string, string | undefined][] = [
    ['Display name', f.name],
    ['Email', f.email],
    ['Password', f.password],
    ['Repeat password', f.confirm ?? f.password],
  ];
  for (const [placeholder, value] of fields) {
    if (value) await user.type(screen.getByPlaceholderText(placeholder), value);
  }
  await user.press(screen.getByRole('button', { name: 'Create account' }));
}

const valid = { name: 'Al', email: 'a@b.com', password: 'secret12' };

describe('SignUpScreen', () => {
  it('requires a name', async () => {
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, { ...valid, name: undefined });
    expect(screen.getByText(/Enter your name/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, { ...valid, email: 'not-an-email' });
    expect(screen.getByText(/look like an email/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, { ...valid, password: 'abc1' });
    expect(screen.getByText(/at least 8 characters\./)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, { ...valid, confirm: 'secret13' });
    expect(screen.getByText(/passwords don.t match/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('passes a normalized email + display_name to signUp', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, { ...valid, email: 'A@B.com ' });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret12',
      options: { data: { display_name: 'Al' } },
    });
  });

  // Regression: a second account with the same email showed a raw English error.
  it('says plainly when the email already has an account', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    });
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, valid);
    expect(await screen.findByText(/An account with this email already exists/)).toBeTruthy();
  });

  it('shows the "check your email" state when signUp returns no session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    await render(<SignUpScreen />);
    await submit(user, valid);
    expect(await screen.findByText('Check your email')).toBeTruthy();
  });
});
