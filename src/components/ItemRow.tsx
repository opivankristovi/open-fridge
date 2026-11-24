import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysInFridge, daysOpen, type ExpiryStatus } from '../domain/expiry';
import { t } from '../i18n';
import { makeStyles, radius, spacing } from '../theme';
import type { Item } from '../types/db';
import { ItemImage } from './ItemImage';
import { StatusBadge } from './StatusBadge';

type Props = { item: Item; status: ExpiryStatus; daysLeft: number | null };

function ItemRowBase({ item, status, daysLeft }: Props) {
  const styles = useStyles();
  const open = daysOpen(item);
  const parts = [t.fridge.inFridge(daysInFridge(item))];
  if (open !== null) parts.push(t.fridge.open(open));
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

const useStyles = makeStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: c.text },
  brand: { fontSize: 13, color: c.textMuted },
  meta: { fontSize: 12, color: c.textMuted },
}));
