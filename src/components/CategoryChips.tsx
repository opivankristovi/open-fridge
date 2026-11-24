import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, categoryLabel, type CategoryKey } from '../domain/categories';
import { t } from '../i18n';
import { makeStyles, radius, spacing } from '../theme';

const KEYS = Object.keys(CATEGORIES) as CategoryKey[];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {allowAll ? <Chip label={t.fridge.all} selected={value === null} onPress={() => onChange(null)} /> : null}
        {KEYS.map((k) => (
          <Chip key={k} label={categoryLabel(k)} selected={value === k} onPress={() => onChange(k)} />
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg * 2,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: c.text },
  chipTextSelected: { color: c.onPrimary },
}));
