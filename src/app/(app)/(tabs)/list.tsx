import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  categorize,
  categoryFor,
  COMMON_ITEMS,
  GROCERY_CATEGORIES,
  type CommonItem,
  type GroceryCategory,
} from '../../../../lib/groceries';
import { useListItems, type ListItem } from '../../../../hooks/useListItems';
import { useShoppingList } from '../../../../hooks/useShoppingList';

type Section = { category: GroceryCategory; data: ListItem[] };

// Group items by grocery category (in taxonomy order); within a group, still-needed
// items first, checked-off ones sink to the bottom.
function buildSections(items: ListItem[]): Section[] {
  const byKey = new Map<string, ListItem[]>();
  for (const it of items) {
    const key = categoryFor(it.category).key;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(it);
  }
  const sections: Section[] = [];
  for (const category of GROCERY_CATEGORIES) {
    const group = byKey.get(category.key);
    if (!group || group.length === 0) continue;
    const data = [...group].sort((a, b) =>
      a.is_checked !== b.is_checked
        ? a.is_checked
          ? 1
          : -1
        : a.created_at.localeCompare(b.created_at)
    );
    sections.push({ category, data });
  }
  return sections;
}

export default function ListScreen() {
  const theme = useTheme();
  const { listId, loading: listLoading, error: listError, retry: retryList } = useShoppingList();
  const {
    items,
    loading: itemsLoading,
    error: itemsError,
    addItem,
    toggleItem,
    setQuantity,
    removeItem,
    clearChecked,
    retry: retryItems,
  } = useListItems(listId);
  const [draft, setDraft] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);

  const error = listError ?? itemsError;
  const loading = listLoading || (itemsLoading && items.length === 0);
  const canAdd = draft.trim().length > 0 && !!listId;
  const checkedCount = items.filter((i) => i.is_checked).length;
  const sections = useMemo(() => buildSections(items), [items]);
  const activeNames = useMemo(
    () => new Set(items.filter((i) => !i.is_checked).map((i) => i.name.toLowerCase())),
    [items]
  );

  async function handleAdd() {
    if (!canAdd) return;
    const name = draft.trim();
    setDraft('');
    await addItem(name, { category: categorize(name) });
  }

  // Adding a common item that's already on the list just bumps its quantity.
  function addCommon(common: CommonItem) {
    const existing = items.find(
      (i) => !i.is_checked && i.name.toLowerCase() === common.name.toLowerCase()
    );
    if (existing) setQuantity(existing, existing.quantity + 1);
    else addItem(common.name, { category: common.category });
  }

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
              <ThemedText style={styles.addButtonText}>+</ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setShowCatalog((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel="Browse common items"
            style={({ pressed }) => [styles.catalogToggle, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.catalogToggleText}>
              {showCatalog ? '✕  Hide common items' : '✨  Common items'}
            </ThemedText>
          </Pressable>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}>
            {showCatalog ? (
              <Catalog activeNames={activeNames} onAdd={addCommon} />
            ) : loading ? (
              <View style={styles.center}>
                <ActivityIndicator testID="list-loading" />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  Your list is empty.{'\n'}Type an item above, or tap “Common items”.
                </ThemedText>
              </View>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                    {section.category.emoji}  {section.category.label.toUpperCase()}
                  </ThemedText>
                )}
                renderItem={({ item }) => (
                  <ListRow
                    item={item}
                    onToggle={() => toggleItem(item)}
                    onQuantity={(n) => setQuantity(item, n)}
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

function Catalog({
  activeNames,
  onAdd,
}: {
  activeNames: Set<string>;
  onAdd: (item: CommonItem) => void;
}) {
  const theme = useTheme();
  // A small static catalog — a ScrollView renders every chip (no virtualization),
  // so nothing is hidden until scrolled into view.
  return (
    <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
      {GROCERY_CATEGORIES.map((category) => {
        const options = COMMON_ITEMS.filter((c) => c.category === category.key);
        if (options.length === 0) return null;
        return (
          <View key={category.key} style={styles.catalogGroup}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {category.emoji}  {category.label.toUpperCase()}
            </ThemedText>
            <View style={styles.chipWrap}>
              {options.map((common) => {
                const added = activeNames.has(common.name.toLowerCase());
                return (
                  <Pressable
                    key={common.name}
                    onPress={() => onAdd(common)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${common.name}`}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                      added && { backgroundColor: theme.tint, borderColor: Accent.primary },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="small"
                      style={added ? { color: Accent.primary, fontWeight: '700' } : undefined}>
                      {added ? '✓ ' : '+ '}
                      {common.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function ListRow({
  item,
  onToggle,
  onQuantity,
  onRemove,
}: {
  item: ListItem;
  onToggle: () => void;
  onQuantity: (n: number) => void;
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
          numberOfLines={1}
          style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>
          {item.name}
        </ThemedText>
      </Pressable>

      {item.is_checked ? null : (
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onQuantity(item.quantity - 1)}
            disabled={item.quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${item.name}`}
            hitSlop={6}
            style={({ pressed }) => [styles.stepBtn, { opacity: item.quantity <= 1 ? 0.35 : pressed ? 0.6 : 1 }]}>
            <ThemedText style={styles.stepBtnText}>−</ThemedText>
          </Pressable>
          <ThemedText style={styles.stepValue}>{item.quantity}</ThemedText>
          <Pressable
            onPress={() => onQuantity(item.quantity + 1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${item.name}`}
            hitSlop={6}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
            <ThemedText style={styles.stepBtnText}>＋</ThemedText>
          </Pressable>
        </View>
      )}

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
  addRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
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
    borderRadius: Radius.md,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  addButtonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 26, lineHeight: 30 },
  catalogToggle: { paddingVertical: Spacing.two, marginBottom: Spacing.one },
  catalogToggleText: { color: Accent.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  listContent: { paddingBottom: Spacing.four, gap: Spacing.two },
  sectionHeader: { marginTop: Spacing.three, marginBottom: Spacing.one, letterSpacing: 0.5 },
  catalogGroup: { gap: Spacing.one },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    ...Shadow.card,
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '700', lineHeight: 22, color: Accent.primary },
  stepValue: { fontSize: 16, fontWeight: '700', minWidth: 18, textAlign: 'center', fontVariant: ['tabular-nums'] },
  remove: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
});
