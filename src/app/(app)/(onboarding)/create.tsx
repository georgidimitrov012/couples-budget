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

export default function CreateHouseholdScreen() {
  const theme = useTheme();
  const { createHousehold } = useHousehold();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (loading) return;
    setError(null);
    setLoading(true);
    const { error: createError } = await createHousehold(name);
    // On success the household is set and the (app) gate swaps to the tabs
    // automatically, so this screen unmounts — no navigation needed.
    if (createError) {
      setError(createError);
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
              <ThemedText type="subtitle">Create a household</ThemedText>
              <ThemedText themeColor="textSecondary">
                Give it a name (or keep the default). You&apos;ll get an invite code to share with
                your partner.
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
              placeholder="Household name (optional)"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={handleCreate}
              maxLength={40}
            />

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={handleCreate}
              disabled={loading}
              style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.7 : 1 }]}>
              {loading ? (
                <ActivityIndicator color={Accent.onPrimary} />
              ) : (
                <ThemedText style={styles.buttonText}>Create household</ThemedText>
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
  back: { alignItems: 'center', paddingVertical: Spacing.two },
});
