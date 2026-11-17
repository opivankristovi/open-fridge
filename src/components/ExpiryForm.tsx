import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { shelfDefaults, type CategoryKey, type CategoryOverrides } from '../domain/categories';
import { describeDaysLeft, effectiveExpiry, parseLocalDate, type ExpiryInput } from '../domain/expiry';
import { formatLongDate, formatYmd, toYmd } from '../domain/format';
import { nl } from '../i18n/nl';
import { colors, radius, spacing } from '../theme';
import type { Item } from '../types/db';
import { Stepper } from './Stepper';

export type ExpiryValue = {
  mode: 'date' | 'fresh';
  /** local 'YYYY-MM-DD' */
  expiryDate: string;
  freshDays: number;
  opened: boolean;
  openedDays: number;
};

export type ExpiryFields = Pick<
  Item,
  'expiry_date' | 'fresh_shelf_days' | 'opened_at' | 'opened_shelf_days'
>;

export function defaultExpiryValue(
  category: CategoryKey,
  overrides: CategoryOverrides | null | undefined,
  productOpenedDays?: number | null,
): ExpiryValue {
  const d = shelfDefaults(category, overrides);
  return {
    mode: 'date',
    expiryDate: toYmd(addDays(new Date(), 7)),
    freshDays: d.fresh,
    opened: false,
    openedDays: productOpenedDays ?? d.opened,
  };
}

export function expiryValueFromItem(
  item: Pick<Item, 'expiry_date' | 'fresh_shelf_days' | 'opened_at' | 'opened_shelf_days' | 'category'>,
  overrides: CategoryOverrides | null | undefined,
): ExpiryValue {
  const d = shelfDefaults(item.category, overrides);
  const hasDate = !!item.expiry_date;
  return {
    mode: hasDate || item.fresh_shelf_days == null ? 'date' : 'fresh',
    expiryDate: item.expiry_date ?? toYmd(addDays(new Date(), 7)),
    freshDays: item.fresh_shelf_days ?? d.fresh,
    opened: !!item.opened_at,
    openedDays: item.opened_shelf_days ?? d.opened,
  };
}

/** DB columns for a form value. `existingOpenedAt` keeps the original opening moment on edit. */
export function expiryValueToFields(v: ExpiryValue, existingOpenedAt?: string | null): ExpiryFields {
  return {
    expiry_date: v.mode === 'date' ? v.expiryDate : null,
    fresh_shelf_days: v.mode === 'fresh' ? v.freshDays : null,
    opened_at: v.opened ? (existingOpenedAt ?? new Date().toISOString()) : null,
    opened_shelf_days: v.opened ? v.openedDays : null,
  };
}

type Props = {
  value: ExpiryValue;
  onChange: (next: ExpiryValue) => void;
  /** Used for the live preview of "fresh" items. Defaults to now. */
  addedAt?: string;
  openedAt?: string | null;
};

export function ExpiryForm({ value, onChange, addedAt, openedAt }: Props) {
  const set = (patch: Partial<ExpiryValue>) => onChange({ ...value, ...patch });

  const openPicker = () => {
    DateTimePickerAndroid.open({
      value: parseLocalDate(value.expiryDate),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) set({ expiryDate: toYmd(date) });
      },
    });
  };

  const draft: ExpiryInput = {
    added_at: addedAt ?? new Date().toISOString(),
    ...expiryValueToFields(value, openedAt),
  };
  const eff = effectiveExpiry(draft);
  const preview = eff
    ? nl.expiry.previewUntil(
        formatLongDate(eff.date),
        describeDaysLeft(differenceInCalendarDays(eff.date, new Date())),
      )
    : nl.expiry.previewNone;

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {(['date', 'fresh'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: value.mode === m }}
            onPress={() => set({ mode: m })}
            style={[styles.segmentItem, value.mode === m && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, value.mode === m && styles.segmentTextActive]}>
              {m === 'date' ? nl.expiry.modeDate : nl.expiry.modeFresh}
            </Text>
          </Pressable>
        ))}
      </View>

      {value.mode === 'date' ? (
        <View style={styles.block}>
          <Text style={styles.label}>{nl.expiry.date}</Text>
          <Pressable accessibilityRole="button" onPress={openPicker} style={styles.dateButton}>
            <Text style={styles.dateText}>{formatYmd(value.expiryDate)}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.label}>{nl.expiry.freshDays}</Text>
          <Stepper value={value.freshDays} min={0} max={3650} onChange={(n) => set({ freshDays: n })} />
        </View>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.label}>{nl.expiry.alreadyOpened}</Text>
        <Switch
          value={value.opened}
          onValueChange={(v) => set({ opened: v })}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      {value.opened ? (
        <View style={styles.block}>
          <Text style={styles.label}>{nl.expiry.openedDays}</Text>
          <Stepper value={value.openedDays} min={0} max={3650} onChange={(n) => set({ openedDays: n })} />
        </View>
      ) : null}

      <View style={styles.preview}>
        <Text style={styles.previewText}>{preview}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  segmentItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
  segmentTextActive: { color: '#fff' },
  block: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  dateButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  dateText: { fontSize: 16, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  preview: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md },
  previewText: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
});
