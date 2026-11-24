import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryChips } from '../../components/CategoryChips';
import { ItemRow } from '../../components/ItemRow';
import { LocationChips } from '../../components/LocationChips';
import { Spinner } from '../../components/ui';
import { usePrefs } from '../../data/localPrefs';
import { useLocations, useStockItems } from '../../data/hooks';
import type { CategoryKey } from '../../domain/categories';
import { daysLeft, expiryStatus, type ExpiryStatus } from '../../domain/expiry';
import { locationLabel } from '../../domain/locations';
import { t } from '../../i18n';
import { makeStyles, useColors, radius, spacing } from '../../theme';
import type { Item } from '../../types/db';

type Row = { item: Item; status: ExpiryStatus; daysLeft: number | null };
type Section = { key: ExpiryStatus; title: string; data: Row[] };

const ORDER: ExpiryStatus[] = ['verlopen', 'bijna', 'ok', 'onbekend'];

export default function StockScreen() {
  const styles = useStyles();
  const c = useColors();
  const { data, isPending, isRefetching, refetch } = useStockItems();
  const locationsQuery = useLocations();
  const { prefs, update } = usePrefs();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryKey | null>(null);

  const locations = locationsQuery.data ?? [];
  const multi = locations.length >= 2;
  // A stored filter that no longer exists (location deleted) counts as "all".
  const selected = multi && locations.some((l) => l.id === prefs.locationFilter) ? prefs.locationFilter : null;
  const selectedLocation = selected ? locations.find((l) => l.id === selected) : undefined;
  const locationNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locationsQuery.data ?? []) m.set(l.id, locationLabel(l));
    return m;
  }, [locationsQuery.data]);

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    const rows: Row[] = (data ?? [])
      .filter((i) => (selected ? i.location_id === selected : true))
      .filter((i) => (category ? i.category === category : true))
      .filter((i) => (q ? `${i.name} ${i.brand ?? ''}`.toLowerCase().includes(q) : true))
      .map((item) => ({
        item,
        status: expiryStatus(item, prefs.warnDays, now),
        daysLeft: daysLeft(item, now),
      }));
    return ORDER.map((key) => ({
      key,
      title: t.fridge.sections[key],
      data: rows
        .filter((r) => r.status === key)
        .sort((a, b) =>
          key === 'onbekend'
            ? new Date(b.item.added_at).getTime() - new Date(a.item.added_at).getTime()
            : (a.daysLeft ?? 0) - (b.daysLeft ?? 0),
        ),
    })).filter((s) => s.data.length > 0);
  }, [data, prefs.warnDays, search, category, selected]);

  if (isPending || locationsQuery.isPending) return <Spinner />;

  const isEmpty = (data ?? []).length === 0;
  const locationEmpty = selectedLocation
    ? !(data ?? []).some((i) => i.location_id === selected)
    : false;
  const emptyText =
    selectedLocation && locationEmpty
      ? t.locations.empty(locationLabel(selectedLocation))
      : isEmpty
        ? t.fridge.empty
        : t.fridge.noResults;

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.fridge.searchPlaceholder}
            placeholderTextColor={c.textMuted}
            style={styles.search}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        {multi ? (
          <LocationChips
            locations={locations}
            value={selected}
            onChange={(id) => void update({ locationFilter: id })}
            allowAll
          />
        ) : null}
        <CategoryChips value={category} onChange={setCategory} allowAll />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(r) => r.item.id}
        renderItem={({ item: r }) => (
          <ItemRow
            item={r.item}
            status={r.status}
            daysLeft={r.daysLeft}
            locationName={multi && !selected && r.item.location_id ? locationNames.get(r.item.location_id) : undefined}
          />
        )}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} colors={[c.primary]} progressBackgroundColor={c.surface} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.add.title}
        onPress={() => router.push({ pathname: '/add', params: selected ? { locationId: selected } : {} })}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={32} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  filters: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.surface,
  },
  search: { flex: 1, fontSize: 16, color: c.text, minHeight: 48 },
  list: { padding: spacing.md, paddingBottom: 112, flexGrow: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: c.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: { textAlign: 'center', color: c.textMuted, fontSize: 16, marginTop: spacing.xl },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
}));
