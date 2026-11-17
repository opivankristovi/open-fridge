import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysInFridge, daysOpen, type ExpiryStatus } from '../domain/expiry';
import { nl } from '../i18n/nl';
import { colors, radius, spacing } from '../theme';
import type { Item } from '../types/db';
import { ItemImage } from './ItemImage';
import { StatusBadge } from './StatusBadge';

type Props = { item: Item; status: ExpiryStatus; daysLeft: number | null };

function ItemRowBase({ item, status, daysLeft }: Props) {
  const open = daysOpen(item);
  const parts = [nl.fridge.inFridge(daysInFridge(item))];
  if (open !== null) parts.push(nl.fridge.open(open));
  if (item.quantity > 1) parts.push(`×${item.quantity}`);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <ItemImage item={item} size={56} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
        <StatusBadge status={status} daysLeft={daysLeft} />
        <Text style={styles.meta} numberOfLines={1}>
          {parts.join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

export const ItemRow = memo(ItemRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  brand: { fontSize: 13, color: colors.textMuted },
  meta: { fontSize: 12, color: colors.textMuted },
});
