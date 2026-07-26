import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { Lang } from '../lib/i18n';
import { notificationRoute } from '../lib/push';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useTranslation } from './useTranslation';

// The sender is always the partner (never yourself), so a notification is always
// news worth surfacing even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register this device's Expo push token against the signed-in user's profile.
 * Best-effort and never throws: a denied permission, a simulator, or a write
 * failure just leaves push off. Returns the token when registered, else null.
 */
export async function registerPushToken(userId: string, locale: Lang): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulators/emulators can't get a token

    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (!perm.granted) return null; // denied — don't nag on later launches

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    // Save the token + current language so the send side can localize pushes.
    await supabase.from('profiles').update({ push_token: token, locale }).eq('id', userId);
    return token;
  } catch {
    // Push is a nice-to-have; registration must never take the app down.
    return null;
  }
}

/**
 * Registers the push token once signed in and routes notification taps to the
 * right screen. Mounted once from the authenticated layout.
 */
export function usePushRegistration() {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (user?.id) registerPushToken(user.id, lang);
  }, [user?.id, lang]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = notificationRoute(response.notification.request.content.data);
      if (route) router.push(route);
    });
    return () => sub.remove();
  }, [router]);
}
