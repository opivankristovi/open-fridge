import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryChips } from '../../components/CategoryChips';
import { ItemRow } from '../../components/ItemRow';
import { Spinner } from '../../components/ui';
import { usePrefs } from '../../data/localPrefs';
import { useFridgeItems } from '../../data/hooks';
import type { CategoryKey } from '../../domain/categories';
import { daysLeft, expiryStatus, type ExpiryStatus } from '../../domain/expiry';
import { nl } from '../../i18n/nl';
import { colors, radius, spacing } from '../../theme';
import type { Item } from '../../types/db';

type Row = { item: Item; status: ExpiryStatus; daysLeft: number | null };
type Section = { key: ExpiryStatus; title: string; data: Row[] };

const ORDER: ExpiryStatus[] = ['verlopen', 'bijna', 'ok', 'onbekend'];

export default function FridgeScreen() {
  const { data, isPending, isRefetching, refetch } = useFridgeItems();
  const { prefs } = usePrefs();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryKey | null>(null);

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    const rows: Row[] = (data ?? [])
      .filter((i) => (category ? i.category === category : true))
      .filter((i) => (q ? `${i.name} ${i.brand ?? ''}`.toLowerCase().includes(q) : true))
      .map((item) => ({
        item,
        status: expiryStatus(item, prefs.warnDays, now),
        daysLeft: daysLeft(item, now),
      }));
    return ORDER.map((key) => ({
      key,
      title: nl.fridge.sections[key],
      data: rows
        .filter((r) => r.status === key)
        .sort((a, b) =>
          key === 'onbekend'
            ? new Date(b.item.added_at).getTime() - new Date(a.item.added_at).getTime()
            : (a.daysLeft ?? 0) - (b.daysLeft ?? 0),
        ),
    })).filter((s) => s.data.length > 0);
  }, [data, prefs.warnDays, search, category]);

  if (isPending) return <Spinner />;

  const isEmpty = (data ?? []).length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={nl.fridge.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <CategoryChips value={category} onChange={setCategory} allowAll />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(r) => r.item.id}
        renderItem={({ item: r }) => <ItemRow item={r.item} status={r.status} daysLeft={r.daysLeft} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} colors={[colors.primary]} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>{isEmpty ? nl.fridge.empty : nl.fridge.noResults}</Text>
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nl.add.title}
        onPress={() => router.push('/add')}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  search: { flex: 1, fontSize: 16, color: colors.text, minHeight: 48 },
  list: { padding: spacing.md, paddingBottom: 112, flexGrow: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 16, marginTop: spacing.xl },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
