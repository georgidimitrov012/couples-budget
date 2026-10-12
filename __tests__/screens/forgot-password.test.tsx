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
});
