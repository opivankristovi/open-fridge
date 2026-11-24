import { addDays } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ExpiryForm,
  expiryValueToFields,
  type ExpiryValue,
} from '../../../components/ExpiryForm';
import { LocationChips } from '../../../components/LocationChips';
import { Button, ErrorText, Spinner } from '../../../components/ui';
import { useHouseholdSettings, useItem, useLocations, useMoveItem } from '../../../data/hooks';
import { toYmd } from '../../../domain/format';
import { shelfDefaults } from '../../../domain/shelfLife';
import { t } from '../../../i18n';
import { errorMessage } from '../../../lib/errors';
import { makeStyles, spacing } from '../../../theme';

export default function MoveItemScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);
  const locations = useLocations();
  const settings = useHouseholdSettings();
  const moveItem = useMoveItem();
  const insets = useSafeAreaInsets();

  const [targetId, setTargetId] = useState<string | null>(null);
  // Form value plus the target it was built for, so switching targets rebuilds it.
  const [form, setForm] = useState<{ forTarget: string; value: ExpiryValue; storedAt: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = item.data;
  const all = locations.data ?? [];
  const current = all.find((l) => l.id === data?.location_id);
  const target = all.find((l) => l.id === targetId);

  if (item.isPending || locations.isPending || settings.isPending) return <Spinner />;
  if (!data || data.status !== 'in_fridge') {
    return (
      <View style={styles.gone}>
        <Text style={styles.goneText}>{t.item.gone}</Text>
        <Button title={t.add.back} variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const sameKind = !!target && !!current && target.kind === current.kind;

  const pick = (nextId: string | null) => {
    if (!nextId) return;
    setTargetId(nextId);
    setError(null);
    const next = all.find((l) => l.id === nextId);
    if (!next || (current && next.kind === current.kind)) {
      setForm(null);
      return;
    }
    const d = shelfDefaults(next.kind, data.category, settings.data?.shelf_defaults);
    setForm({
      forTarget: nextId,
      storedAt: new Date().toISOString(),
      value: {
        mode: 'fresh',
        expiryDate: data.expiry_date ?? toYmd(addDays(new Date(), 7)),
        freshDays: d.fresh,
        opened: !!data.opened_at,
        openedDays: d.opened,
      },
    });
  };

  const confirm = async () => {
    if (!target) return;
    setError(null);
    setSaving(true);
    try {
      const patch =
        !sameKind && form
          ? {
              location_id: target.id,
              stored_at: form.storedAt,
              ...expiryValueToFields(form.value, data.opened_at),
            }
          : { location_id: target.id };
      await moveItem.mutateAsync({ id: data.id, patch });
      router.back();
    } catch (e) {
      setSaving(false);
      setError(errorMessage(e) || t.move.failed);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: spacing.md + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.name}>{data.name}</Text>
      <Text style={styles.label}>{t.move.to}</Text>
      <LocationChips locations={all} value={targetId} onChange={pick} exclude={data.location_id ?? undefined} />

      {target && sameKind ? <Text style={styles.hint}>{t.move.sameKind}</Text> : null}
      {target && !sameKind && form && form.forTarget === target.id ? (
        <>
          <Text style={styles.hint}>{t.move.newShelf}</Text>
          <ExpiryForm
            value={form.value}
            onChange={(value) => setForm({ ...form, value })}
            storedAt={form.storedAt}
            openedAt={data.opened_at}
            category={data.category}
            kind={target.kind}
          />
        </>
      ) : null}

      <ErrorText message={error} />
      <Button title={t.move.confirm} onPress={confirm} loading={saving} disabled={!target} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, backgroundColor: c.background },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: c.background },
  goneText: { fontSize: 18, fontWeight: '600', color: c.text, textAlign: 'center' },
  name: { fontSize: 22, fontWeight: '800', color: c.text },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  hint: { fontSize: 14, color: c.textMuted },
}));
