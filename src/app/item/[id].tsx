import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemImage } from '../../components/ItemImage';
import { StatusBadge } from '../../components/StatusBadge';
import { OpenedShelfInput } from '../../components/OpenedShelfInput';
import { Button, Card, ErrorText, Spinner } from '../../components/ui';
import {
  useDeleteItem,
  useHouseholdSettings,
  useItem,
  useLocations,
  useMarkOpened,
  useMembers,
  useProduct,
  useRemoveItem,
} from '../../data/hooks';
import { usePrefs } from '../../data/localPrefs';
import { setProductOpenedDays } from '../../data/productsRepo';
import { CATEGORIES, categoryLabel } from '../../domain/categories';
import {
  daysInHouse,
  daysLeft,
  daysOpen,
  effectiveExpiry,
  expiryStatus,
} from '../../domain/expiry';
import { formatLongDate, formatShortDate } from '../../domain/format';
import { locationLabel } from '../../domain/locations';
import { shelfDefaults } from '../../domain/shelfLife';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { makeStyles, spacing } from '../../theme';

export default function ItemDetailScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);
  const members = useMembers();
  const settings = useHouseholdSettings();
  const locations = useLocations();
  const product = useProduct(item.data?.barcode);
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();

  const markOpened = useMarkOpened();
  const removeItem = useRemoveItem();
  const deleteItem = useDeleteItem();

  const [showOpen, setShowOpen] = useState(false);
  const [openDays, setOpenDays] = useState<number | null>(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = item.data;
  const allLocations = locations.data ?? [];
  const location = allLocations.find((l) => l.id === data?.location_id);
  const kind = location?.kind ?? 'fridge';
  const categoryOpened = data ? shelfDefaults(kind, data.category, settings.data?.shelf_defaults).opened : 3;
  // What the household learned about opened shelf life only applies to fridges.
  const defaultOpenDays = data
    ? kind === 'fridge'
      ? (product.data?.last_opened_shelf_days ?? categoryOpened)
      : categoryOpened
    : 3;
  useEffect(() => {
    setOpenDays(defaultOpenDays);
  }, [defaultOpenDays]);

  if (item.isPending || locations.isPending) return <Spinner />;

  if (!data || data.status !== 'in_fridge') {
    // Missing, or removed (possibly by someone else in the meantime). Stay quiet while we leave ourselves.
    return (
      <View style={styles.gone}>
        {busy ? (
          <Spinner />
        ) : (
          <>
            <Text style={styles.goneText}>{t.item.gone}</Text>
            <Button title={t.add.back} variant="outline" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }

  const status = expiryStatus(data, prefs.warnDays);
  const left = daysLeft(data);
  const eff = effectiveExpiry(data);
  const adder = members.data?.find((m) => m.user_id === data.added_by)?.display_name ?? t.history.unknownUser;
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
      setError(errorMessage(e) || t.item.actionFailed);
    }
  };

  const confirmOpened = () =>
    run(async () => {
      await markOpened.mutateAsync({ id: data.id, shelfDays: openDays });
      if (data.barcode && kind === 'fridge') {
        await setProductOpenedDays(data.household_id, data.barcode, openDays).catch(() => undefined);
      }
      setShowOpen(false);
    }, false);

  const confirmDelete = () =>
    Alert.alert(t.item.removeTitle, t.item.removeBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.item.remove,
        style: 'destructive',
        onPress: () => void run(() => deleteItem.mutateAsync(data), true),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.md + insets.bottom }]}>
      <ItemImage item={data} size={240} fill />

      <View style={styles.titleBlock}>
        <Text style={styles.name}>{data.name}</Text>
        {data.brand ? <Text style={styles.brand}>{data.brand}</Text> : null}
        <Text style={styles.meta}>
          {categoryLabel(data.category)}
          {allLocations.length >= 2 && location ? ` · ${locationLabel(location)}` : ''} ·{' '}
          {t.item.quantity(data.quantity)}
        </Text>
      </View>

      <Card>
        <StatusBadge status={status} daysLeft={left} />
        <Text style={styles.until}>
          {eff ? t.item.until(formatLongDate(eff.date)) : t.item.noExpiry}
        </Text>
        {eff ? <Text style={styles.meta}>{t.item.ruleSource[eff.rule]}</Text> : null}
        <Text style={styles.meta}>
          {t.item.addedBy(formatShortDate(data.added_at), adder, daysInHouse(data) > 0 ? t.days(daysInHouse(data)) : '')}
        </Text>
        {data.opened_at && opened !== null ? (
          <Text style={styles.meta}>
            {data.opened_shelf_days === null
              ? t.item.openedUntilPackage(formatShortDate(data.opened_at))
              : t.item.openedOn(formatShortDate(data.opened_at), t.days(opened))}
          </Text>
        ) : null}
      </Card>

      {!data.opened_at && CATEGORIES[data.category].canOpen ? (
        showOpen ? (
          <Card>
            <Text style={styles.label}>{t.item.openedPanelTitle}</Text>
            <OpenedShelfInput value={openDays} onChange={setOpenDays} fallbackDays={categoryOpened ?? 3} />
            <Button title={t.item.confirmOpened} onPress={confirmOpened} loading={busy} />
            <Button title={t.common.cancel} variant="outline" onPress={() => setShowOpen(false)} disabled={busy} />
          </Card>
        ) : (
          <Button title={t.item.markOpened} variant="outline" onPress={() => setShowOpen(true)} disabled={busy} />
        )
      ) : null}

      <ErrorText message={error} />

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title={t.item.consumed}
            disabled={busy}
            onPress={() => run(() => removeItem.mutateAsync({ id: data.id, status: 'consumed' }), true)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={t.item.discarded}
            variant="outline"
            disabled={busy}
            onPress={() => run(() => removeItem.mutateAsync({ id: data.id, status: 'discarded' }), true)}
          />
        </View>
      </View>
      {allLocations.length >= 2 ? (
        <Button
          title={t.move.action}
          variant="outline"
          disabled={busy}
          onPress={() => router.push({ pathname: '/item/move/[id]', params: { id: data.id } })}
        />
      ) : null}
      <Button
        title={t.item.edit}
        variant="outline"
        disabled={busy}
        onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: data.id } })}
      />
      <Button title={t.item.remove} variant="danger" disabled={busy} onPress={confirmDelete} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, backgroundColor: c.background },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: c.background },
  goneText: { fontSize: 18, fontWeight: '600', color: c.text, textAlign: 'center' },
  titleBlock: { gap: 2 },
  name: { fontSize: 26, fontWeight: '800', color: c.text },
  brand: { fontSize: 16, color: c.textMuted },
  meta: { fontSize: 14, color: c.textMuted },
  until: { fontSize: 18, fontWeight: '700', color: c.text },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
}));
