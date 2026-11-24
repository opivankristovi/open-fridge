import { ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORIES, categoryLabel, type CategoryKey } from '../domain/categories';
import { t } from '../i18n';
import { makeStyles, spacing } from '../theme';
import { Chip } from './Chip';

const KEYS = Object.keys(CATEGORIES) as CategoryKey[];

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

const useStyles = makeStyles(() => StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
}));
