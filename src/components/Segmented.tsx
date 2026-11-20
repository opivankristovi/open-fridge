import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, radius, spacing } from '../theme';

type Props<T extends string> = {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
};

/** Equal-width segmented control, same look as the "dagen / datum op verpakking" toggle. */
export function Segmented<T extends string>({ value, options, onChange }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          style={[styles.item, value === o.value && styles.itemActive]}
        >
          <Text style={[styles.text, value === o.value && styles.textActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
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
  }),
);
