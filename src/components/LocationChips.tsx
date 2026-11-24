import { ScrollView, StyleSheet, View } from 'react-native';

import { KIND_ICONS, locationLabel } from '../domain/locations';
import { t } from '../i18n';
import { makeStyles, spacing } from '../theme';
import type { StorageLocation } from '../types/db';
import { Chip } from './Chip';

/** Horizontal location chips. With `allowAll`, a leading "Overal" chip represents `null`. */
export function LocationChips({
  locations,
  value,
  onChange,
  allowAll = false,
  exclude,
}: {
  locations: StorageLocation[];
  value: string | null;
  onChange: (next: string | null) => void;
  allowAll?: boolean;
  exclude?: string;
}) {
  const styles = useStyles();
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {allowAll ? (
          <Chip label={t.locations.all} selected={value === null} onPress={() => onChange(null)} />
        ) : null}
        {locations
          .filter((l) => l.id !== exclude)
          .map((l) => (
            <Chip
              key={l.id}
              icon={KIND_ICONS[l.kind]}
              label={locationLabel(l)}
              selected={value === l.id}
              onPress={() => onChange(l.id)}
            />
          ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
}));
