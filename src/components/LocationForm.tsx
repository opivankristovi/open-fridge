import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { KIND_ICONS, kindLabel, LOCATION_KINDS, type LocationKind } from '../domain/locations';
import { t } from '../i18n';
import { makeStyles, spacing } from '../theme';
import { Chip } from './Chip';
import { Field } from './ui';

/** Name + kind fields shared by the new/edit location screens. */
export function LocationForm({
  name,
  onNameChange,
  kind,
  onKindChange,
}: {
  name: string;
  onNameChange: (v: string) => void;
  kind: LocationKind;
  onKindChange: (k: LocationKind) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <Field
        label={t.locations.name}
        value={name}
        onChangeText={onNameChange}
        placeholder={kindLabel(kind)}
        autoCapitalize="sentences"
        maxLength={60}
      />
      <Text style={styles.label}>{t.locations.kind}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {LOCATION_KINDS.map((k) => (
          <Chip key={k} icon={KIND_ICONS[k]} label={kindLabel(k)} selected={kind === k} onPress={() => onKindChange(k)} />
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  wrap: { gap: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
}));
