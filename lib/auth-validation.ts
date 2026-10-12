// Sign-up / sign-in / password-reset checks and friendly error messages. Pure (no
// React, no Supabase import) so it's unit-tested directly; the screens turn the
// returned i18n keys into text with t().

export const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 40;

export type Problem = { key: string; params?: Record<string, string | number> };

/** Emails are case-insensitive in practice; store and compare them lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deliberately simple: something@domain.tld, no spaces. The server has the final say. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(normalizeEmail(email));
}

/** At least MIN_PASSWORD_LENGTH characters, with a letter and a digit. */
export function passwordProblem(password: string, confirm?: string): Problem | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { key: 'error.passwordShort', params: { min: MIN_PASSWORD_LENGTH } };
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return { key: 'error.passwordWeak' };
  if (confirm !== undefined && confirm !== password) return { key: 'error.passwordMismatch' };
  return null;
}

/** The first thing wrong with a sign-up form, in field order, or null. */
export function signUpProblem(form: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): Problem | null {
  const name = form.name.trim();
  if (!name) return { key: 'error.nameRequired' };
  if (name.length > MAX_NAME_LENGTH) return { key: 'error.nameLong', params: { max: MAX_NAME_LENGTH } };
  if (!form.email.trim()) return { key: 'error.emailRequired' };
  if (!isValidEmail(form.email)) return { key: 'error.emailInvalid' };
  return passwordProblem(form.password, form.confirm);
}

type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

/**
 * Map a Supabase auth error to an i18n key, so people see "An account with this
 * email already exists" in their language instead of "User already registered".
 * Unknown errors fall back to a generic message carrying the original text.
 */
export function authErrorProblem(error: AuthErrorLike): Problem {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) {
    return { key: 'auth.err.exists' };
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return { key: 'auth.err.invalidCreds' };
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return { key: 'auth.err.notConfirmed' };
  }
  if (code.startsWith('over_') || error?.status === 429 || msg.includes('rate limit')) {
    return { key: 'auth.err.rateLimit' };
  }
  if (code === 'weak_password' || msg.includes('password should')) return { key: 'auth.err.weakPassword' };
  if (code === 'same_password' || msg.includes('different from the old')) return { key: 'auth.err.samePassword' };
  if (code === 'otp_expired' || /token has expired|invalid.*(otp|token)/.test(msg)) {
    return { key: 'auth.err.badCode' };
  }
  if (code === 'email_address_invalid' || msg.includes('invalid format') || msg.includes('email address')) {
    return { key: 'error.emailInvalid' };
  }
  if (msg.includes('network request failed') || msg.includes('fetch')) return { key: 'auth.err.network' };
  return { key: 'auth.err.generic', params: { message: error?.message ?? '' } };
}
