// @sentry/react-native is stubbed globally in test/setup.ts. Each test isolates
// the module so the one-time `enabled` latch starts fresh.

describe('crash reporting', () => {
  it('stays a no-op when no DSN is provided', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native');
      const { initCrashReporting, isCrashReportingEnabled, reportError } = require('../../lib/crash-reporting');

      expect(initCrashReporting(undefined)).toBe(false);
      expect(isCrashReportingEnabled()).toBe(false);

      reportError(new Error('ignored'));
      expect(Sentry.init).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  it('initialises Sentry and reports errors once a DSN is set', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native');
      const { initCrashReporting, isCrashReportingEnabled, reportError } = require('../../lib/crash-reporting');

      const dsn = 'https://key@o0.ingest.sentry.io/1';
      expect(initCrashReporting(dsn)).toBe(true);
      expect(isCrashReportingEnabled()).toBe(true);
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ dsn, sendDefaultPii: false }),
      );

      const err = new Error('boom');
      reportError(err, { componentStack: 'x' });
      expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { componentStack: 'x' } });
    });
  });

  it('initialises Sentry at most once', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native');
      const { initCrashReporting } = require('../../lib/crash-reporting');
      const dsn = 'https://key@o0.ingest.sentry.io/1';
      initCrashReporting(dsn);
      initCrashReporting(dsn);
      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });
});
