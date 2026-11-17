import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Card, Spinner } from '../../components/ui';
import { useHistory, useMembers, useRestoreItem } from '../../data/hooks';
import { formatShortDate } from '../../domain/format';
import { nl } from '../../i18n/nl';
import { colors, radius, spacing } from '../../theme';
import type { Item } from '../../types/db';

export default function HistoryScreen() {
  const { data, isPending, isRefetching, refetch } = useHistory(30);
  const members = useMembers();
  const restore = useRestoreItem();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    (members.data ?? []).forEach((m) => map.set(m.user_id, m.display_name));
    return map;
  }, [members.data]);

  if (isPending) return <Spinner />;

  const items = data ?? [];
  const eaten = items.filter((i) => i.status === 'consumed').length;
  const tossed = items.filter((i) => i.status === 'discarded').length;

  const onRestore = async (item: Item) => {
    setRestoringId(item.id);
    try {
      await restore.mutateAsync(item.id);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} colors={[colors.primary]} />}
      ListHeaderComponent={
        <Card>
          <Text style={styles.summaryTitle}>{nl.history.title}</Text>
          <Text style={styles.summary}>{nl.history.summary(eaten, tossed)}</Text>
        </Card>
      }
      ListEmptyComponent={<Text style={styles.empty}>{nl.history.empty}</Text>}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const consumed = item.status === 'consumed';
        const who = (item.removed_by && names.get(item.removed_by)) || nl.history.unknownUser;
        return (
          <View style={styles.row}>
            <Ionicons
              name={consumed ? 'checkmark-circle' : 'trash'}
              size={28}
              color={consumed ? colors.status.ok : colors.status.verlopen}
            />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.removed_at ? formatShortDate(item.removed_at) : ''} · {nl.history.by(who)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={restoringId === item.id}
              onPress={() => onRestore(item)}
              style={[styles.restore, restoringId === item.id && { opacity: 0.5 }]}
            >
              <Text style={styles.restoreText}>{nl.history.restore}</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  summaryTitle: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  summary: { fontSize: 20, fontWeight: '800', color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 16, marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  restore: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  restoreText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
