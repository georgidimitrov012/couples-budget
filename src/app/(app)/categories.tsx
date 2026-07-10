import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '../../../hooks/useAuth';
import { useCategories, type Category, type CategoryScope } from '../../../hooks/useCategories';

const PRIMARY = '#3c87f7';
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
  const { categories, loading, error, addCategory, removeCategory } = useCategories();

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [scope, setScope] = useState<CategoryScope>('shared');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (saving || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    const { error: addError } = await addCategory({ name, color, scope });
    if (addError) {
      setFormError(addError);
      setSaving(false);
      return;
    }
    setName('');
    setScope('shared');
    setColor(CATEGORY_COLORS[0]);
    setSaving(false);
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
                  <ActivityIndicator color="#ffffff" />
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
                  canDelete={item.owner_id === user?.id}
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

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: CategoryScope;
  onChange: (s: CategoryScope) => void;
}) {
  const theme = useTheme();
  const options: { value: CategoryScope; label: string }[] = [
    { value: 'shared', label: 'Ours' },
    { value: 'private', label: 'Mine' },
  ];
  return (
    <View style={[styles.toggle, { backgroundColor: theme.background }]}>
      {options.map((o) => {
        const active = scope === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Scope: ${o.label}`}
            style={[styles.toggleOption, active && { backgroundColor: PRIMARY }]}>
            <ThemedText
              type="smallBold"
              style={active ? styles.toggleTextActive : { color: theme.textSecondary }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function CategoryRow({
  category,
  canDelete,
  onRemove,
}: {
  category: Category;
  canDelete: boolean;
  onRemove: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: category.color ?? '#60646c' }]} />
      <ThemedText style={styles.rowName} numberOfLines={1}>
        {category.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {category.scope === 'shared' ? 'Ours' : 'Mine'}
      </ThemedText>
      {canDelete && (
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
  close: { color: PRIMARY, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.6 },
  addCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    marginBottom: Spacing.three,
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
  toggle: { flexDirection: 'row', borderRadius: Spacing.two, padding: 2 },
  toggleOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two - 2,
  },
  toggleTextActive: { color: '#ffffff' },
  addButton: {
    backgroundColor: PRIMARY,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  errorText: { color: '#e5484d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  listContent: { gap: Spacing.two, paddingVertical: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
  rowName: { flex: 1, fontSize: 16 },
  remove: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
});
