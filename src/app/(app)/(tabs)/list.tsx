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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useListItems, type ListItem } from '../../../../hooks/useListItems';
import { useShoppingList } from '../../../../hooks/useShoppingList';

export default function ListScreen() {
  const theme = useTheme();
  const { listId, loading: listLoading, error: listError, retry: retryList } = useShoppingList();
  const {
    items,
    loading: itemsLoading,
    error: itemsError,
    addItem,
    toggleItem,
    removeItem,
    clearChecked,
    retry: retryItems,
  } = useListItems(listId);
  const [draft, setDraft] = useState('');

  const error = listError ?? itemsError;
  const loading = listLoading || (itemsLoading && items.length === 0);
  const canAdd = draft.trim().length > 0 && !!listId;
  const checkedCount = items.filter((i) => i.is_checked).length;

  async function handleAdd() {
    if (!canAdd) return;
    const name = draft.trim();
    setDraft('');
    await addItem(name);
  }

  // A load error can live in either hook (resolving the list vs. its items).
  function handleRetry() {
    retryList();
    retryItems();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Shopping list</ThemedText>
            {checkedCount > 0 && (
              <Pressable
                onPress={clearChecked}
                accessibilityRole="button"
                accessibilityLabel="Clear checked items"
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="small" themeColor="textSecondary">
                  Clear checked ({checkedCount})
                </ThemedText>
              </Pressable>
            )}
          </View>

          {error && (
            <Pressable
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry"
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.banner}>
                <ThemedText type="small" style={styles.bannerText}>
                  {error} — tap to retry
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}>
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
                placeholder="Add an item…"
                placeholderTextColor={theme.textSecondary}
                value={draft}
                onChangeText={setDraft}
                editable={!!listId}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
              <Pressable
                onPress={handleAdd}
                disabled={!canAdd}
                accessibilityRole="button"
                accessibilityLabel="Add item"
                style={({ pressed }) => [styles.addButton, { opacity: pressed || !canAdd ? 0.6 : 1 }]}>
                <ThemedText style={styles.addButtonText}>Add</ThemedText>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator testID="list-loading" />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  No items yet.{'\n'}Add your first one above.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <ListRow
                    item={item}
                    onToggle={() => toggleItem(item)}
                    onRemove={() => removeItem(item)}
                  />
                )}
              />
            )}
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function ListRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ListItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_checked }}
        accessibilityLabel={item.name}
        hitSlop={8}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <View
          style={[
            styles.checkbox,
            { borderColor: theme.textSecondary },
            item.is_checked && styles.checkboxChecked,
          ]}>
          {item.is_checked && <ThemedText style={styles.checkmark}>✓</ThemedText>}
        </View>
        <ThemedText
          themeColor={item.is_checked ? 'textSecondary' : 'text'}
          style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>
          {item.name}
          {item.quantity > 1 ? `  ×${item.quantity}` : ''}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          ✕
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  pressed: { opacity: 0.6 },
  banner: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  bannerText: { color: Accent.danger },
  addRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: Accent.primary,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  listContent: { gap: Spacing.two, paddingVertical: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Accent.primary, borderColor: Accent.primary },
  checkmark: { color: Accent.onPrimary, fontSize: 14, fontWeight: '700', lineHeight: 16 },
  itemName: { flex: 1, fontSize: 16 },
  itemNameChecked: { textDecorationLine: 'line-through' },
  remove: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
});
