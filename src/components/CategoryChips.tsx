import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, type CategoryKey } from '../domain/categories';
import { nl } from '../i18n/nl';
import { colors, radius, spacing } from '../theme';

const KEYS = Object.keys(CATEGORIES) as CategoryKey[];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal chips. With `allowAll`, a leading "Alles" chip represents `null`. */
export function CategoryChips({
  value,
  onChange,
  allowAll = false,
}: {
  value: CategoryKey | null;
  onChange: (next: CategoryKey | null) => void;
  allowAll?: boolean;
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {allowAll ? <Chip label={nl.fridge.all} selected={value === null} onPress={() => onChange(null)} /> : null}
        {KEYS.map((k) => (
          <Chip key={k} label={CATEGORIES[k].label} selected={value === k} onPress={() => onChange(k)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg * 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: '#fff' },
});
