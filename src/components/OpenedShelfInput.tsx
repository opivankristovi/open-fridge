import { Pressable, StyleSheet, Text, View } from 'react-native';

import { nl } from '../i18n/nl';
import { makeStyles, radius, spacing } from '../theme';
import { Stepper } from './Stepper';

type Props = {
  /** number of days after opening, or null = until the date printed on the package */
  value: number | null;
  onChange: (next: number | null) => void;
  /** days to start from when switching from "package" to "days" */
  fallbackDays: number;
};

export function OpenedShelfInput({ value, onChange, fallbackDays }: Props) {
  const styles = useStyles();
  const isDays = value !== null;
  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {([true, false] as const).map((days) => (
          <Pressable
            key={String(days)}
            accessibilityRole="button"
            accessibilityState={{ selected: isDays === days }}
            onPress={() => {
              if (days && !isDays) onChange(fallbackDays);
              else if (!days && isDays) onChange(null);
            }}
            style={[styles.item, isDays === days && styles.itemActive]}
          >
            <Text style={[styles.text, isDays === days && styles.textActive]}>
              {days ? nl.openedInput.days : nl.openedInput.package}
            </Text>
          </Pressable>
        ))}
      </View>
      {isDays ? <Stepper value={value} min={0} max={365} onChange={onChange} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  wrap: { gap: spacing.sm },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  itemActive: { backgroundColor: c.primary },
  text: { fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' },
  textActive: { color: c.onPrimary },
}));
