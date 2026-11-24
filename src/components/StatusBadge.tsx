import { StyleSheet, Text, View } from 'react-native';

import { describeDaysLeft, type ExpiryStatus } from '../domain/expiry';
import { t } from '../i18n';
import { makeStyles, useColors, radius, spacing } from '../theme';

export function StatusBadge({ status, daysLeft }: { status: ExpiryStatus; daysLeft: number | null }) {
  const styles = useStyles();
  const c = useColors();
  const color = status === 'verlopen' ? c.status.verlopen
    : status === 'bijna' ? c.status.bijna
    : status === 'ok' ? c.status.ok
    : c.status.onbekend;
  const text = daysLeft === null ? t.fridge.noDate : describeDaysLeft(daysLeft);
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  text: { color: c.onStatus, fontSize: 12, fontWeight: '700' },
}));
