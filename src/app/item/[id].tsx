import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemImage } from '../../components/ItemImage';
import { StatusBadge } from '../../components/StatusBadge';
import { Stepper } from '../../components/Stepper';
import { Button, Card, ErrorText, Spinner } from '../../components/ui';
import {
  useDeleteItem,
  useHouseholdSettings,
  useItem,
  useMarkOpened,
  useMembers,
  useProduct,
  useRemoveItem,
} from '../../data/hooks';
import { usePrefs } from '../../data/localPrefs';
import { setProductOpenedDays } from '../../data/productsRepo';
import { CATEGORIES, shelfDefaults } from '../../domain/categories';
import {
  daysInFridge,
  daysLeft,
  daysOpen,
  effectiveExpiry,
  expiryStatus,
} from '../../domain/expiry';
import { formatLongDate, formatShortDate } from '../../domain/format';
import { dagen, nl } from '../../i18n/nl';
import { errorMessage } from '../../lib/errors';
import { colors, spacing } from '../../theme';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);
  const members = useMembers();
  const settings = useHouseholdSettings();
  const product = useProduct(item.data?.barcode);
  const { prefs } = usePrefs();

  const markOpened = useMarkOpened();
  const removeItem = useRemoveItem();
  const deleteItem = useDeleteItem();

  const [showOpen, setShowOpen] = useState(false);
  const [openDays, setOpenDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = item.data;
  const defaultOpenDays = data
    ? (product.data?.last_opened_shelf_days ??
      shelfDefaults(data.category, settings.data?.category_defaults).opened)
    : 3;
  useEffect(() => {
    setOpenDays(defaultOpenDays);
  }, [defaultOpenDays]);

  if (item.isPending) return <Spinner />;

  if (!data || data.status !== 'in_fridge') {
    // Missing, or removed (possibly by someone else in the meantime). Stay quiet while we leave ourselves.
    return (
      <View style={styles.gone}>
        {busy ? (
          <Spinner />
        ) : (
          <>
            <Text style={styles.goneText}>{nl.item.gone}</Text>
            <Button title={nl.add.back} variant="outline" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }

  const status = expiryStatus(data, prefs.warnDays);
  const left = daysLeft(data);
  const eff = effectiveExpiry(data);
  const adder = members.data?.find((m) => m.user_id === data.added_by)?.display_name ?? nl.history.unknownUser;
  const opened = daysOpen(data);

  const run = async (fn: () => Promise<unknown>, leave: boolean) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      if (leave) router.back();
      else setBusy(false);
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e) || nl.item.actionFailed);
    }
  };

  const confirmOpened = () =>
    run(async () => {
      await markOpened.mutateAsync({ id: data.id, shelfDays: openDays });
      if (data.barcode) {
        await setProductOpenedDays(data.household_id, data.barcode, openDays).catch(() => undefined);
      }
      setShowOpen(false);
    }, false);

  const confirmDelete = () =>
    Alert.alert(nl.item.removeTitle, nl.item.removeBody, [
      { text: nl.common.cancel, style: 'cancel' },
      {
        text: nl.item.remove,
        style: 'destructive',
        onPress: () => void run(() => deleteItem.mutateAsync(data), true),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ItemImage item={data} size={240} fill />

      <View style={styles.titleBlock}>
        <Text style={styles.name}>{data.name}</Text>
        {data.brand ? <Text style={styles.brand}>{data.brand}</Text> : null}
        <Text style={styles.meta}>
          {CATEGORIES[data.category].label} · {nl.item.quantity(data.quantity)}
        </Text>
      </View>

      <Card>
        <StatusBadge status={status} daysLeft={left} />
        <Text style={styles.until}>
          {eff ? nl.item.until(formatLongDate(eff.date)) : nl.item.noExpiry}
        </Text>
        {eff ? <Text style={styles.meta}>{nl.item.ruleSource[eff.rule]}</Text> : null}
        <Text style={styles.meta}>
          {nl.item.addedBy(formatShortDate(data.added_at), adder, dagen(daysInFridge(data)))}
        </Text>
        {data.opened_at && opened !== null ? (
          <Text style={styles.meta}>{nl.item.openedOn(formatShortDate(data.opened_at), dagen(opened))}</Text>
        ) : null}
      </Card>

      {!data.opened_at ? (
        showOpen ? (
          <Card>
            <Text style={styles.label}>{nl.item.openedPanelTitle}</Text>
            <Stepper value={openDays} min={0} max={3650} onChange={setOpenDays} />
            <Button title={nl.item.confirmOpened} onPress={confirmOpened} loading={busy} />
            <Button title={nl.common.cancel} variant="outline" onPress={() => setShowOpen(false)} disabled={busy} />
          </Card>
        ) : (
          <Button title={nl.item.markOpened} variant="outline" onPress={() => setShowOpen(true)} disabled={busy} />
        )
      ) : null}

      <ErrorText message={error} />

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title={nl.item.consumed}
            disabled={busy}
            onPress={() => run(() => removeItem.mutateAsync({ id: data.id, status: 'consumed' }), true)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={nl.item.discarded}
            variant="outline"
            disabled={busy}
            onPress={() => run(() => removeItem.mutateAsync({ id: data.id, status: 'discarded' }), true)}
          />
        </View>
      </View>
      <Button
        title={nl.item.edit}
        variant="outline"
        disabled={busy}
        onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: data.id } })}
      />
      <Button title={nl.item.remove} variant="danger" disabled={busy} onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  goneText: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  titleBlock: { gap: 2 },
  name: { fontSize: 26, fontWeight: '800', color: colors.text },
  brand: { fontSize: 16, color: colors.textMuted },
  meta: { fontSize: 14, color: colors.textMuted },
  until: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
