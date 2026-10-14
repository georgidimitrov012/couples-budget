import React from 'react';
import { Alert } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';

const mockReset = jest.fn();
const mockVerify = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...a: unknown[]) => mockReset(...a),
      verifyOtp: (...a: unknown[]) => mockVerify(...a),
      updateUser: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

import ForgotPasswordScreen from '../../src/app/(auth)/forgot-password';

// The first render in a file is slow under a parallel or coverage run.
jest.setTimeout(30000);

beforeEach(() => {
  mockReset.mockReset().mockResolvedValue({ error: null });
  mockVerify.mockReset().mockResolvedValue({ error: null });
  mockUpdate.mockReset().mockResolvedValue({ error: null });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

async function requestCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Email'), 'A@b.com');
  await user.press(screen.getByRole('button', { name: 'Send code' }));
}

async function enterNewPassword(user: ReturnType<typeof userEvent.setup>, code: string, password: string) {
  await user.type(await screen.findByPlaceholderText('Code from the email'), code);
  await user.type(screen.getByPlaceholderText('New password'), password);
  await user.type(screen.getByPlaceholderText('Repeat password'), password);
  await user.press(screen.getByRole('button', { name: 'Set new password' }));
}

describe('ForgotPasswordScreen', () => {
  it('validates the email before sending', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await user.type(screen.getByPlaceholderText('Email'), 'nope');
    await user.press(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText(/look like an email/)).toBeTruthy();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('sends a code, then verifies it and sets the new password', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    expect(mockReset).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByText(/a code is on its way/)).toBeTruthy();

    await enterNewPassword(user, '123 456', 'newpass12');

    expect(mockVerify).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'recovery' });
    expect(mockUpdate).toHaveBeenCalledWith({ password: 'newpass12' });
    expect(Alert.alert).toHaveBeenCalledWith('Password changed', expect.any(String));
  });

  it('explains a wrong or expired code and does not change the password', async () => {
    mockVerify.mockResolvedValue({
      error: { message: 'Token has expired or is invalid', code: 'otp_expired' },
    });
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await enterNewPassword(user, '000000', 'newpass12');

    expect(await screen.findByText(/wrong or has expired/)).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('checks the new password before using the code', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await enterNewPassword(user, '123456', 'short1');
    expect(screen.getByText(/at least 8 characters\./)).toBeTruthy();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('asks for an email when it is empty', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await user.press(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Enter your email.')).toBeTruthy();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('stays on the email step and explains when sending fails', async () => {
    mockReset.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
    });
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Code from the email')).toBeNull();
  });

  it('asks for the code when it is empty', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await user.type(await screen.findByPlaceholderText('New password'), 'newpass12');
    await user.type(screen.getByPlaceholderText('Repeat password'), 'newpass12');
    await user.press(screen.getByRole('button', { name: 'Set new password' }));
    expect(screen.getByText('Enter the code from the email.')).toBeTruthy();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects mismatched new passwords before using the code', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await user.type(await screen.findByPlaceholderText('Code from the email'), '123456');
    await user.type(screen.getByPlaceholderText('New password'), 'newpass12');
    await user.type(screen.getByPlaceholderText('Repeat password'), 'newpass13');
    await user.press(screen.getByRole('button', { name: 'Set new password' }));
    expect(screen.getByText(/passwords don.t match/)).toBeTruthy();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('tells the person when the new password is refused after the code worked', async () => {
    mockUpdate.mockResolvedValue({
      error: { code: 'same_password', message: 'New password should be different from the old password.' },
    });
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await enterNewPassword(user, '123456', 'newpass12');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reset your password',
      'Choose a password different from your old one.'
    );
  });

  it('can send a new code, or go back and use a different email', async () => {
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await user.press(await screen.findByRole('button', { name: 'Send a new code' }));
    expect(mockReset).toHaveBeenCalledTimes(2);

    await user.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Code from the email')).toBeNull();
  });

  it('ignores a second tap while sending', async () => {
    let finish: (v: unknown) => void = () => {};
    mockReset.mockReturnValue(new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    await render(<ForgotPasswordScreen />);
    await requestCode(user);
    await user.press(screen.getByRole('button', { name: '' }));
    expect(mockReset).toHaveBeenCalledTimes(1);
    finish({ error: null });
  });
});
