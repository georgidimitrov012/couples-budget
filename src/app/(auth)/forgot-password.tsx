import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  authErrorProblem,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  passwordProblem,
  type Problem,
} from '../../../lib/auth-validation';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Password reset with a one-time code, not a link: Supabase emails a code
 * ({{ .Token }} in the "Reset Password" template — docs/SUPABASE_SETUP.md), the
 * person types it here with a new password. No deep link or redirect URL to
 * configure, so it works the same in every build.
 *
 * Verifying the code signs the person in, which makes the root guard leave this
 * screen — so the new password is set in the same tap, right after the verify.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const error = problem ? t(problem.key, problem.params) : null;

  async function sendCode() {
    if (loading) return;
    if (!email.trim()) return setProblem({ key: 'error.emailRequired' });
    if (!isValidEmail(email)) return setProblem({ key: 'error.emailInvalid' });
    setProblem(null);
    setLoading(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
    setLoading(false);
    // Supabase answers the same whether or not the email has an account, so the
    // screen can't be used to find out who's registered.
    if (sendError) setProblem(authErrorProblem(sendError));
    else setCodeSent(true);
  }

  async function savePassword() {
    if (loading) return;
    const token = code.replace(/\s/g, '');
    if (!token) return setProblem({ key: 'error.codeRequired' });
    const weak = passwordProblem(password, confirm);
    if (weak) return setProblem(weak);
    setProblem(null);
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token,
      type: 'recovery',
    });
    if (verifyError) {
      setLoading(false);
      setProblem(authErrorProblem(verifyError));
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    // By now the person is signed in and this screen is on its way out; an
    // alert is the one thing that survives the navigation.
    if (updateError) Alert.alert(t('forgot.title'), t(authErrorProblem(updateError).key));
    else Alert.alert(t('forgot.doneTitle'), t('forgot.doneBody'));
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <ThemedText type="subtitle">{t('forgot.title')}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {codeSent ? t('forgot.codeSent', { email: normalizeEmail(email) }) : t('forgot.subtitle')}
              </ThemedText>
            </View>

            {!codeSent ? (
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
                returnKeyType="go"
                onSubmitEditing={sendCode}
              />
            ) : (
              <View style={styles.fields}>
                <TextInput
                  style={inputStyle}
                  placeholder={t('field.code')}
                  placeholderTextColor={theme.textSecondary}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  editable={!loading}
                  returnKeyType="next"
                />
                <TextInput
                  style={inputStyle}
                  placeholder={t('field.newPassword')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  returnKeyType="next"
                />
                <TextInput
                  style={inputStyle}
                  placeholder={t('field.confirmPassword')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
                  editable={!loading}
                  returnKeyType="go"
                  onSubmitEditing={savePassword}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('signup.passwordHint', { min: MIN_PASSWORD_LENGTH })}
                </ThemedText>
              </View>
            )}

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={codeSent ? savePassword : sendCode}
              disabled={loading}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }]}>
              {loading ? (
                <ActivityIndicator color={Accent.onPrimary} />
              ) : (
                <ThemedText style={styles.buttonText}>
                  {codeSent ? t('forgot.save') : t('forgot.send')}
                </ThemedText>
              )}
            </Pressable>

            {codeSent && (
              <View style={styles.secondaryRow}>
                <Pressable onPress={sendCode} disabled={loading} accessibilityRole="button" hitSlop={8}>
                  <ThemedText type="small" style={styles.link}>
                    {t('forgot.resend')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCodeSent(false);
                    setCode('');
                    setProblem(null);
                  }}
                  disabled={loading}
                  accessibilityRole="button"
                  hitSlop={8}>
                  <ThemedText type="small" style={styles.link}>
                    {t('forgot.changeEmail')}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <Link href="/sign-in" asChild>
              <Pressable disabled={loading} accessibilityRole="button" style={styles.back}>
                <ThemedText type="small" style={styles.link}>
                  {t('forgot.back')}
                </ThemedText>
              </Pressable>
            </Link>
          </ScrollView>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.three },
  back: { alignSelf: 'center' },
  link: { color: Accent.primary, fontWeight: '600' },
});
