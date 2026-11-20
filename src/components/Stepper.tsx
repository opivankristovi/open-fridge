import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useColors, radius, spacing } from '../theme';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
};

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, format }: Props) {
  const styles = useStyles();
  const c = useColors();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Minder"
        onPress={() => onChange(clamp(value - step))}
        disabled={value <= min}
        style={[styles.btn, value <= min && styles.disabled]}
      >
        <Ionicons name="remove" size={22} color={c.primary} />
      </Pressable>
      <Text style={styles.value}>{format ? format(value) : String(value)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Meer"
        onPress={() => onChange(clamp(value + step))}
        disabled={value >= max}
        style={[styles.btn, value >= max && styles.disabled]}
      >
        <Ionicons name="add" size={22} color={c.primary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  value: { minWidth: 56, textAlign: 'center', fontSize: 18, fontWeight: '700', color: c.text },
}));
