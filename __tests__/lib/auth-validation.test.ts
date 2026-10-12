import {
  authErrorProblem,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
  signUpProblem,
} from '../../lib/auth-validation';

describe('emails', () => {
  it('normalizes case and spaces', () => {
    expect(normalizeEmail('  Georgi@Gmail.COM ')).toBe('georgi@gmail.com');
  });

  it('accepts real-looking addresses and rejects the rest', () => {
    for (const ok of ['a@b.co', 'first.last+tag@mail.example.bg', ' A@B.com ']) {
      expect(isValidEmail(ok)).toBe(true);
    }
    for (const bad of ['', 'a', 'a@b', 'a@b.c', 'a b@c.com', '@b.com', 'a@.com', 'a@b..com']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe('passwordProblem', () => {
  it('needs 8+ characters with a letter and a digit, and a matching confirmation', () => {
    expect(passwordProblem('abc12')?.key).toBe('error.passwordShort');
    expect(passwordProblem('abcdefgh')?.key).toBe('error.passwordWeak');
    expect(passwordProblem('12345678')?.key).toBe('error.passwordWeak');
    expect(passwordProblem('парола123')).toBeNull(); // Cyrillic letters count
    expect(passwordProblem('secret12', 'secret13')?.key).toBe('error.passwordMismatch');
    expect(passwordProblem('secret12', 'secret12')).toBeNull();
  });
});

describe('signUpProblem', () => {
  const ok = { name: 'Ана', email: 'a@b.com', password: 'secret12', confirm: 'secret12' };

  it('reports the first problem in field order', () => {
    expect(signUpProblem({ ...ok, name: '  ', email: 'x' })?.key).toBe('error.nameRequired');
    expect(signUpProblem({ ...ok, name: 'x'.repeat(41) })?.key).toBe('error.nameLong');
    expect(signUpProblem({ ...ok, email: '' })?.key).toBe('error.emailRequired');
    expect(signUpProblem({ ...ok, email: 'x@y' })?.key).toBe('error.emailInvalid');
    expect(signUpProblem({ ...ok, confirm: '' })?.key).toBe('error.passwordMismatch');
    expect(signUpProblem(ok)).toBeNull();
  });
});

describe('authErrorProblem', () => {
  it.each([
    [{ code: 'user_already_exists', message: 'User already registered' }, 'auth.err.exists'],
    [{ message: 'Invalid login credentials' }, 'auth.err.invalidCreds'],
    [{ code: 'email_not_confirmed' }, 'auth.err.notConfirmed'],
    [{ code: 'over_email_send_rate_limit' }, 'auth.err.rateLimit'],
    [{ status: 429, message: 'Too many' }, 'auth.err.rateLimit'],
    [{ code: 'weak_password' }, 'auth.err.weakPassword'],
    [{ code: 'same_password' }, 'auth.err.samePassword'],
    [{ code: 'otp_expired', message: 'Token has expired or is invalid' }, 'auth.err.badCode'],
    [{ message: 'Network request failed' }, 'auth.err.network'],
  ])('%j → %s', (error, key) => {
    expect(authErrorProblem(error).key).toBe(key);
  });

  it('falls back to a generic message that keeps the original text', () => {
    expect(authErrorProblem({ message: 'Weird' })).toEqual({
      key: 'auth.err.generic',
      params: { message: 'Weird' },
    });
  });
});
