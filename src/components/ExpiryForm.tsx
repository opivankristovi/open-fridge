import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useHouseholdSettings } from '../data/hooks';
import { CATEGORIES, type CategoryKey } from '../domain/categories';
import { describeDaysLeft, effectiveExpiry, parseLocalDate, type ExpiryInput } from '../domain/expiry';
import { formatLongDate, formatYmd, toYmd } from '../domain/format';
import type { LocationKind } from '../domain/locations';
import { shelfDefaults, type ShelfOverrides } from '../domain/shelfLife';
import { t } from '../i18n';
import { makeStyles, useColors, radius, spacing } from '../theme';
import type { Item } from '../types/db';
import { OpenedShelfInput } from './OpenedShelfInput';
import { Stepper } from './Stepper';

export type ExpiryValue = {
  mode: 'date' | 'fresh';
  /** local 'YYYY-MM-DD' */
  expiryDate: string;
  freshDays: number;
  opened: boolean;
  /** null = until the date printed on the package */
  openedDays: number | null;
};

export type ExpiryFields = Pick<
  Item,
  'expiry_date' | 'fresh_shelf_days' | 'opened_at' | 'opened_shelf_days'
>;

export function defaultExpiryValue(
  kind: LocationKind,
  category: CategoryKey,
  overrides: ShelfOverrides | null | undefined,
  productOpenedDays?: number | null,
): ExpiryValue {
  const d = shelfDefaults(kind, category, overrides);
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
  kind: LocationKind,
  overrides: ShelfOverrides | null | undefined,
): ExpiryValue {
  const d = shelfDefaults(kind, item.category, overrides);
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
  /** When the item entered its location; used for the live preview of "fresh" items. Defaults to now. */
  storedAt?: string;
  openedAt?: string | null;
  category: CategoryKey;
  kind: LocationKind;
};

export function ExpiryForm({ value, onChange, storedAt, openedAt, category, kind }: Props) {
  const styles = useStyles();
  const c = useColors();
  const settings = useHouseholdSettings();
  const canOpen = CATEGORIES[category].canOpen;
  const fallbackDays =
    shelfDefaults(kind, category, settings.data?.shelf_defaults).opened ?? 3;
  useEffect(() => {
    if (!canOpen && value.opened) onChange({ ...value, opened: false });
  }, [canOpen, value, onChange]);
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

  const now = new Date().toISOString();
  const draft: ExpiryInput = {
    added_at: storedAt ?? now,
    stored_at: storedAt ?? now,
    ...expiryValueToFields(value, openedAt),
  };
  const eff = effectiveExpiry(draft);
  const preview = eff
    ? t.expiry.previewUntil(
        formatLongDate(eff.date),
        describeDaysLeft(differenceInCalendarDays(eff.date, new Date())),
      )
    : t.expiry.previewNone;

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
              {m === 'date' ? t.expiry.modeDate : t.expiry.modeFresh}
            </Text>
          </Pressable>
        ))}
      </View>

      {value.mode === 'date' ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t.expiry.date}</Text>
          <Pressable accessibilityRole="button" onPress={openPicker} style={styles.dateButton}>
            <Text style={styles.dateText}>{formatYmd(value.expiryDate)}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.label}>{t.expiry.freshDays}</Text>
          <Stepper value={value.freshDays} min={0} max={3650} onChange={(n) => set({ freshDays: n })} />
        </View>
      )}

      {canOpen ? (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.label}>{t.expiry.alreadyOpened}</Text>
            <Switch
              value={value.opened}
              onValueChange={(v) => set({ opened: v })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>
          {value.opened ? (
            <View style={styles.block}>
              <Text style={styles.label}>{t.expiry.openedDays}</Text>
              <OpenedShelfInput
                value={value.openedDays}
                onChange={(n) => set({ openedDays: n })}
                fallbackDays={fallbackDays}
              />
              {value.mode === 'fresh' && value.openedDays === null ? (
                <Text style={styles.hint}>{t.expiry.openedNullHint}</Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.preview}>
        <Text style={styles.previewText}>{preview}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  wrap: { gap: spacing.md },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  segmentItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  segmentItemActive: { backgroundColor: c.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' },
  segmentTextActive: { color: c.onPrimary },
  block: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  dateButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  dateText: { fontSize: 16, color: c.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  hint: { fontSize: 13, color: c.textMuted },
  preview: { backgroundColor: c.primaryLight, borderRadius: radius.md, padding: spacing.md },
  previewText: { fontSize: 15, fontWeight: '600', color: c.primaryDark },
}));
