import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScopeToggle } from '@/components/scope-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount } from '../../../lib/format';
import {
  buildPayload,
  buildReviewLines,
  reviewTotal,
  type LineAction,
  type ReviewLine,
} from '../../../lib/receipt';
import { useListItems } from '../../../hooks/useListItems';
import { useReceiptScan } from '../../../hooks/useReceiptScan';
import { useShoppingList } from '../../../hooks/useShoppingList';

type Image = { base64: string; uri: string; mimeType?: string };
type Phase = 'capture' | 'scanning' | 'review';

export default function ReceiptScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { listId } = useShoppingList();
  const { items: listItems } = useListItems(listId);
  const { scan, apply, scanning, applying, error } = useReceiptScan();

  const [phase, setPhase] = useState<Phase>('capture');
  const [image, setImage] = useState<Image | null>(null);
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [purchasedOn, setPurchasedOn] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  async function runScan(picked: Image) {
    setImage(picked);
    setPhase('scanning');
    const result = await scan({ base64: picked.base64, mimeType: picked.mimeType });
    if (!result) {
      setPhase('capture');
      return;
    }
    setMerchant(result.merchant);
    setPurchasedOn(result.purchased_on);
    setCurrency(result.currency);
    setLines(buildReviewLines(result, listItems));
    setPhase('review');
  }

  async function takePhoto() {
    setCaptureError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setCaptureError('Camera access is needed to scan a receipt. Enable it in Settings.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5, mediaTypes: ['images'] });
    const asset = res.canceled ? null : res.assets[0];
    if (asset?.base64) runScan({ base64: asset.base64, uri: asset.uri, mimeType: asset.mimeType });
  }

  async function pickPhoto() {
    setCaptureError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ['images'] });
    const asset = res.canceled ? null : res.assets[0];
    if (asset?.base64) runScan({ base64: asset.base64, uri: asset.uri, mimeType: asset.mimeType });
  }

  function updateLine(key: string, patch: Partial<ReviewLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const { valid, lines: payload } = buildPayload(lines);
  const total = reviewTotal(lines);

  async function handleSubmit() {
    if (!valid || !image) return;
    const ok = await apply({
      image: { base64: image.base64, mimeType: image.mimeType },
      merchant,
      purchasedOn,
      currency,
      lines: payload,
    });
    if (ok) router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Scan receipt</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.close}>{phase === 'review' ? 'Cancel' : 'Done'}</ThemedText>
            </Pressable>
          </View>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          {phase === 'capture' && (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                Take or choose a photo of a paper receipt. We&apos;ll pull out the items so you can
                review them before adding them to your budget.
              </ThemedText>
              {captureError && (
                <ThemedText type="small" style={styles.errorText}>
                  {captureError}
                </ThemedText>
              )}
              <Pressable
                onPress={takePhoto}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText style={styles.primaryButtonText}>Take photo</ThemedText>
              </Pressable>
              <Pressable
                onPress={pickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Choose from library"
                style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText style={styles.secondaryButtonText}>Choose from library</ThemedText>
              </Pressable>
            </View>
          )}

          {phase === 'scanning' && (
            <View style={styles.center}>
              <ActivityIndicator testID="receipt-scanning" />
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                Reading your receipt…
              </ThemedText>
            </View>
          )}

          {phase === 'review' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.flex}>
              {(merchant || purchasedOn) && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.metaLine}>
                  {[merchant, purchasedOn].filter(Boolean).join(' · ')}
                </ThemedText>
              )}
              {lines.length === 0 ? (
                <View style={styles.center}>
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    No items found on that receipt.{'\n'}Try a clearer photo.
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={lines}
                  keyExtractor={(l) => l.key}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <ReviewRow line={item} onChange={(patch) => updateLine(item.key, patch)} />
                  )}
                />
              )}

              <View style={styles.footer}>
                <View style={styles.totalRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    TOTAL
                  </ThemedText>
                  <ThemedText type="subtitle" testID="receipt-total">
                    {formatAmount(total)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={handleSubmit}
                  disabled={!valid || applying}
                  accessibilityRole="button"
                  accessibilityLabel="Submit receipt"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { opacity: pressed || !valid || applying ? 0.6 : 1 },
                  ]}>
                  {applying ? (
                    <ActivityIndicator color={Accent.onPrimary} />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Add to budget</ThemedText>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function ReviewRow({
  line,
  onChange,
}: {
  line: ReviewLine;
  onChange: (patch: Partial<ReviewLine>) => void;
}) {
  const theme = useTheme();
  const actions: { value: LineAction; label: string; hidden?: boolean }[] = [
    { value: 'add', label: 'Add' },
    { value: 'check', label: line.matchName ? `Check: ${line.matchName}` : 'Check', hidden: !line.listItemId },
    { value: 'skip', label: 'Skip' },
  ];
  const dim = line.action === 'skip';

  return (
    <ThemedView type="backgroundElement" style={[styles.row, dim && styles.rowDim]}>
      <View style={styles.rowTop}>
        <TextInput
          style={[styles.nameInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          value={line.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="Item"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Item name"
        />
        <TextInput
          style={[styles.priceInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          value={line.price}
          onChangeText={(price) => onChange({ price })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Item price"
        />
      </View>

      <View style={styles.rowBottom}>
        <View style={styles.actionGroup}>
          {actions
            .filter((a) => !a.hidden)
            .map((a) => {
              const active = line.action === a.value;
              return (
                <Pressable
                  key={a.value}
                  onPress={() => onChange({ action: a.value })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${a.label}${active ? ' (selected)' : ''}`}
                  style={[
                    styles.actionChip,
                    { borderColor: theme.backgroundSelected },
                    active && { backgroundColor: Accent.primary, borderColor: Accent.primary },
                  ]}>
                  <ThemedText type="small" style={active ? styles.actionChipTextActive : { color: theme.textSecondary }}>
                    {a.label}
                  </ThemedText>
                </Pressable>
              );
            })}
        </View>
        {!dim && <ScopeToggle scope={line.scope} onChange={(scope) => onChange({ scope })} />}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  close: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.6 },
  errorText: { color: Accent.danger, marginBottom: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  centerText: { textAlign: 'center' },
  metaLine: { marginBottom: Spacing.two },
  listContent: { gap: Spacing.two, paddingVertical: Spacing.one },
  row: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  rowDim: { opacity: 0.5 },
  rowTop: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  nameInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  priceInput: {
    width: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    textAlign: 'right',
  },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  actionGroup: { flexDirection: 'row', gap: Spacing.one, flexShrink: 1, flexWrap: 'wrap' },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionChipTextActive: { color: Accent.onPrimary },
  footer: { gap: Spacing.two, paddingVertical: Spacing.three },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: Accent.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  secondaryButton: { alignSelf: 'stretch', paddingVertical: Spacing.three, alignItems: 'center' },
  secondaryButtonText: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
});
