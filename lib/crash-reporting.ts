// Optional crash reporting, wired to Sentry but completely inert until a DSN is
// provided at build time via EXPO_PUBLIC_SENTRY_DSN. No DSN -> no init, no
// network, every call is a no-op. See docs/CRASH_REPORTING.md to switch it on.
import * as Sentry from '@sentry/react-native';

let enabled = false;

/**
 * Initialise crash reporting once, at app start. Returns whether it turned on.
 * A no-op (returns false) when no DSN is supplied, so development builds and the
 * test suite never talk to Sentry. The dsn is read from EXPO_PUBLIC_SENTRY_DSN
 * by default; it's a parameter so it can be exercised directly in tests.
 */
export function initCrashReporting(
  dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN,
): boolean {
  if (enabled) return true;
  if (!dsn) return false;
  try {
    Sentry.init({
      dsn,
      // The app handles couples' financial data — never attach PII by default.
      sendDefaultPii: false,
    });
    enabled = true;
  } catch {
    // Crash reporting must never take the app down with it.
    enabled = false;
  }
  return enabled;
}

/** Report a caught error. A no-op unless crash reporting was initialised. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting failures stay silent — they must not surface to the user.
  }
}

/** Whether a DSN was provided and Sentry initialised successfully. */
export function isCrashReportingEnabled(): boolean {
  return enabled;
}
