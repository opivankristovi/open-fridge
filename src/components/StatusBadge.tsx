import { StyleSheet, Text, View } from 'react-native';

import { describeDaysLeft, type ExpiryStatus } from '../domain/expiry';
import { nl } from '../i18n/nl';
import { colors, radius, spacing } from '../theme';

export function StatusBadge({ status, daysLeft }: { status: ExpiryStatus; daysLeft: number | null }) {
  const color = status === 'verlopen' ? colors.status.verlopen
    : status === 'bijna' ? colors.status.bijna
    : status === 'ok' ? colors.status.ok
    : colors.status.onbekend;
  const text = daysLeft === null ? nl.fridge.noDate : describeDaysLeft(daysLeft);
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
