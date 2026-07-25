# Crash reporting (Sentry)

The app ships with an **error boundary** (`src/components/error-boundary.tsx`) that
catches render/lifecycle crashes anywhere in the tree and shows a friendly, localized
recovery screen with a **Try again** button — instead of a white screen or a hard
crash on launch.

Remote reporting is wired to **Sentry** but stays **completely inert until you supply a
DSN**. No DSN → `Sentry.init()` is never called, nothing is sent, every reporting call
is a no-op. This keeps development builds and the test suite offline by default.

## Turn it on

1. **Create a Sentry project** (React Native platform) at <https://sentry.io> and copy its
   **DSN** (a public client key — safe to ship in the app, so `EXPO_PUBLIC_` is fine).

2. **Add the DSN to `.env`** (do **not** commit `.env`):

   ```
   EXPO_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
   ```

3. **Rebuild.** `EXPO_PUBLIC_*` values are inlined at build time, so the DSN only takes
   effect in a fresh build:

   ```
   pnpm dlx eas-cli@latest build -p android --profile preview
   ```

That's it — `initCrashReporting()` runs on app start (`src/app/_layout.tsx`), sees the DSN,
initialises Sentry, and the error boundary forwards every caught crash via
`reportError()`.

## Optional: readable stack traces (source maps)

For symbolicated stack traces, the Sentry Expo config plugin (already added to `app.json`)
can upload source maps during EAS builds. That step needs, at build time only:

- `SENTRY_AUTH_TOKEN` — a Sentry auth token (an **EAS secret**, never in the repo)
- your Sentry **org** and **project** slugs (in the plugin config or env)

Without them the build still succeeds; you just get minified stack traces. Basic crash
capture (step 1–3 above) does **not** require the auth token.

## Privacy

`Sentry.init` is configured with `sendDefaultPii: false` — the app handles couples'
financial data, so no personally identifiable information is attached to events by
default. Keep it that way; scrub anything sensitive before adding custom context.

## Notes

- `lib/crash-reporting.ts` is the only integration point (`initCrashReporting`,
  `reportError`, `isCrashReportingEnabled`).
- Tests stub `@sentry/react-native` in `test/setup.ts`, so the suite never loads the
  native SDK.
