import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from '../../../hooks/useTranslation';

const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the project requires email confirmation: signUp returns no session.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSignUp() {
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      setError(t('error.enterCreds'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('error.passwordShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Seeds public.profiles.display_name via the on_auth_user_created trigger.
      options: { data: { display_name: displayName.trim() || undefined } },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // If email confirmation is enabled, there's no session yet — the user must
    // confirm via the emailed link before signing in. Otherwise, the session is
    // set and the root guard redirects into the app automatically.
    if (!data.session) {
      setAwaitingConfirmation(true);
    }
  }

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: theme.backgroundSelected,
    },
  ];

  if (awaitingConfirmation) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.form, styles.centered]}>
            <ThemedText type="subtitle">{t('signup.checkTitle')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {t('signup.checkBody', { email: email.trim() })}
            </ThemedText>
            <Link href="/sign-in" asChild>
              <Pressable style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}>
                <ThemedText style={styles.buttonText}>{t('signup.backToSignin')}</ThemedText>
              </Pressable>
            </Link>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <View style={styles.form}>
            <View style={styles.header}>
              <ThemedText type="subtitle">{t('signup.title')}</ThemedText>
              <ThemedText themeColor="textSecondary">{t('signup.subtitle')}</ThemedText>
            </View>

            <View style={styles.fields}>
              <TextInput
                style={inputStyle}
                placeholder={t('field.displayName')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
                autoComplete="name"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!loading}
                returnKeyType="next"
              />
              <TextInput
                style={inputStyle}
                placeholder={t('field.email')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                returnKeyType="next"
              />
              <TextInput
                style={inputStyle}
                placeholder={t('field.password')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                returnKeyType="go"
                onSubmitEditing={handleSignUp}
              />
            </View>

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }]}>
              {loading ? (
                <ActivityIndicator color={Accent.onPrimary} />
              ) : (
                <ThemedText style={styles.buttonText}>{t('signup.button')}</ThemedText>
              )}
            </Pressable>

            <View style={styles.footer}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('signup.haveAccount')}
              </ThemedText>
              <Link href="/sign-in" asChild>
                <Pressable disabled={loading}>
                  <ThemedText type="small" style={styles.link}>
                    {t('signup.signin')}
                  </ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  header: { gap: Spacing.two },
  fields: { gap: Spacing.three },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  error: { color: Accent.danger },
  button: {
    backgroundColor: Accent.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  buttonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  link: { color: Accent.primary, fontWeight: '600' },
});
