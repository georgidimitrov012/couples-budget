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
import { useHousehold } from '../../../../hooks/useHousehold';

const CODE_LENGTH = 6;

export default function JoinHouseholdScreen() {
  const theme = useTheme();
  const { joinHousehold } = useHousehold();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (loading) return;
    setError(null);
    if (code.trim().length < CODE_LENGTH) {
      setError(`Enter your ${CODE_LENGTH}-character invite code.`);
      return;
    }
    setLoading(true);
    // The RPC returns friendly messages ("Invalid invite code", "This household
    // is already full"), so we surface them directly.
    const { error: joinError } = await joinHousehold(code);
    if (joinError) {
      setError(joinError);
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <View style={styles.form}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Join a household</ThemedText>
              <ThemedText themeColor="textSecondary">
                Enter the 6-character code your partner shared with you.
              </ThemedText>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
              placeholder="ABC123"
              placeholderTextColor={theme.textSecondary}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CODE_LENGTH}
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={handleJoin}
            />

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={handleJoin}
              disabled={loading}
              style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }]}>
              {loading ? (
                <ActivityIndicator color={Accent.onPrimary} />
              ) : (
                <ThemedText style={styles.buttonText}>Join household</ThemedText>
              )}
            </Pressable>

            <Link href="/welcome" asChild>
              <Pressable disabled={loading} style={styles.back}>
                <ThemedText type="small" themeColor="textSecondary">
                  Back
                </ThemedText>
              </Pressable>
            </Link>
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
  form: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.four },
  header: { gap: Spacing.two },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
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
  back: { alignItems: 'center', paddingVertical: Spacing.two },
});
