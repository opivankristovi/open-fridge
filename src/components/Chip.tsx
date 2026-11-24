import type React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { makeStyles, radius, spacing, useColors } from '../theme';

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Ionicons name */
  icon?: string;
}) {
  const styles = useStyles();
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? (
        <Ionicons
          name={icon as React.ComponentProps<typeof Ionicons>['name']}
          size={16}
          color={selected ? c.onPrimary : c.textMuted}
        />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg * 2,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: c.text },
  chipTextSelected: { color: c.onPrimary },
}));
