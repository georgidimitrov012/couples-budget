// Pure helpers for push notifications. The native registration lives in
// hooks/usePushRegistration.ts; the send side (Edge Function) is separate.

/** Where a tapped notification should take the user, based on its data payload. */
export type PushRoute = '/list' | '/budget';

/**
 * Map a notification's `data.screen` to an in-app route, or null if it doesn't
 * point anywhere we can navigate. Shopping events → the list; money events → the
 * budget.
 */
export function notificationRoute(data: unknown): PushRoute | null {
  if (!data || typeof data !== 'object') return null;
  const screen = (data as { screen?: unknown }).screen;
  if (screen === 'list') return '/list';
  if (screen === 'budget') return '/budget';
  return null;
}
