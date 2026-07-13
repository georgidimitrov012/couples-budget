import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScopeToggle } from '@/components/scope-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseAmount } from '../../../lib/format';
import { useAuth } from '../../../hooks/useAuth';
import { useCategories, type Category, type CategoryScope } from '../../../hooks/useCategories';

const CATEGORY_COLORS = [
  '#e5484d',
  '#f76b15',
  '#f5d90a',
  '#30a46c',
  '#3c87f7',
  '#8e4ec6',
  '#e93d82',
  '#60646c',
];

export default function CategoriesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { categories, loading, error, addCategory, updateCategory, removeCategory } = useCategories();

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [scope, setScope] = useState<CategoryScope>('shared');
  const [limit, setLimit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (saving || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    const { error: addError } = await addCategory({
      name,
      color,
      scope,
      monthlyLimit: parseAmount(limit),
    });
    if (addError) {
      setFormError(addError);
      setSaving(false);
      return;
    }
    setName('');
    setScope('shared');
    setColor(CATEGORY_COLORS[0]);
    setLimit('');
    setSaving(false);
  }

  // Commit a row's edited monthly limit, skipping no-op writes.
  function handleSetLimit(cat: Category, next: number | null) {
    if (next === cat.monthly_limit) return;
    updateCategory(cat, { monthlyLimit: next });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Categories</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.close}>Done</ThemedText>
            </Pressable>
          </View>

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
              ]}
              placeholder="Category name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            <View style={styles.swatchRow}>
              {CATEGORY_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected: color === c }}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && { borderColor: theme.text, borderWidth: 3 },
                  ]}
                />
              ))}
            </View>

            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
              ]}
              placeholder="Monthly limit (optional)"
              placeholderTextColor={theme.textSecondary}
              value={limit}
              onChangeText={setLimit}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={handleAdd}
              accessibilityLabel="Monthly limit"
            />

            <View style={styles.formRow}>
              <ScopeToggle scope={scope} onChange={setScope} />
              <Pressable
                onPress={handleAdd}
                disabled={!name.trim() || saving}
                accessibilityRole="button"
                accessibilityLabel="Add category"
                style={({ pressed }) => [
                  styles.addButton,
                  { opacity: pressed || !name.trim() || saving ? 0.6 : 1 },
                ]}>
                {saving ? (
                  <ActivityIndicator color={Accent.onPrimary} />
                ) : (
                  <ThemedText style={styles.addButtonText}>Add</ThemedText>
                )}
              </Pressable>
            </View>

            {formError && (
              <ThemedText type="small" style={styles.errorText}>
                {formError}
              </ThemedText>
            )}
          </ThemedView>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator testID="categories-loading" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                No categories yet.{'\n'}Add one above to tag your expenses.
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <CategoryRow
                  category={item}
                  canEdit={item.owner_id === user?.id}
                  onSetLimit={(next) => handleSetLimit(item, next)}
                  onRemove={() => removeCategory(item)}
                />
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function CategoryRow({
  category,
  canEdit,
  onSetLimit,
  onRemove,
}: {
  category: Category;
  canEdit: boolean;
  onSetLimit: (next: number | null) => void;
  onRemove: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: category.color ?? '#60646c' }]} />
      <View style={styles.rowMain}>
        <ThemedText style={styles.rowName} numberOfLines={1}>
          {category.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {category.scope === 'shared' ? 'Ours' : 'Mine'}
        </ThemedText>
      </View>
      {canEdit ? (
        <LimitInput
          categoryName={category.name}
          value={category.monthly_limit}
          onCommit={onSetLimit}
        />
      ) : category.monthly_limit != null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Limit {category.monthly_limit}
        </ThemedText>
      ) : null}
      {canEdit && (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${category.name}`}
          hitSlop={8}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            ✕
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

// Editable monthly limit; commits on blur/submit. Empty or invalid clears it.
function LimitInput({
  categoryName,
  value,
  onCommit,
}: {
  categoryName: string;
  value: number | null;
  onCommit: (next: number | null) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value != null ? String(value) : '');
  useEffect(() => {
    setText(value != null ? String(value) : '');
  }, [value]);

  return (
    <TextInput
      style={[styles.limitInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
      value={text}
      onChangeText={setText}
      onEndEditing={() => onCommit(text.trim() === '' ? null : parseAmount(text))}
      keyboardType="decimal-pad"
      returnKeyType="done"
      placeholder="Limit"
      placeholderTextColor={theme.textSecondary}
      accessibilityLabel={`Monthly limit for ${categoryName}`}
    />
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
  addCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
    marginBottom: Spacing.three,
    ...Shadow.card,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: {
    backgroundColor: Accent.primary,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  errorText: { color: Accent.danger },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  listContent: { gap: Spacing.two, paddingVertical: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
    ...Shadow.card,
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
  rowMain: { flex: 1, gap: Spacing.half },
  rowName: { fontSize: 16 },
  limitInput: {
    width: 76,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
    textAlign: 'right',
  },
  remove: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
});
