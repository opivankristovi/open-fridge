import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { LocationChips } from '../../components/LocationChips';
import { LocationForm } from '../../components/LocationForm';
import { Button, ErrorText, Placeholder, Screen, Spinner } from '../../components/ui';
import {
  useDeleteLocation,
  useLocations,
  useStockItems,
  useUpdateLocation,
} from '../../data/hooks';
import type { LocationKind } from '../../domain/locations';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { makeStyles, spacing } from '../../theme';

export default function EditLocationScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const locations = useLocations();
  const stock = useStockItems();
  const update = useUpdateLocation();
  const del = useDeleteLocation();

  const [name, setName] = useState<string | null>(null);
  const [kind, setKind] = useState<LocationKind | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // after our own delete, keep a spinner until router.back() lands instead of flashing "gone"
  const [deleting, setDeleting] = useState(false);

  if (locations.isPending || stock.isPending) return <Spinner />;
  const all = locations.data ?? [];
  const loc = all.find((l) => l.id === id);
  if (!loc) return deleting ? <Spinner /> : <Placeholder text={t.locations.gone} />;

  const count = (stock.data ?? []).filter((i) => i.location_id === loc.id).length;
  const isLast = all.length <= 1;
  const needsTarget = count > 0;
  const formName = name ?? loc.name ?? '';
  const formKind = kind ?? loc.kind;
  const validMoveTo = moveTo && moveTo !== loc.id && all.some((l) => l.id === moveTo) ? moveTo : null;

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: loc.id, patch: { name: formName.trim() || null, kind: formKind } });
      router.back();
    } catch (e) {
      setError(errorMessage(e) || t.locations.saveFailed);
    }
  };

  const remove = () => {
    setError(null);
    Alert.alert(t.locations.deleteTitle, t.locations.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.locations.delete,
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          del
            .mutateAsync({ id: loc.id, moveTo: needsTarget ? validMoveTo : null })
            .then(() => router.back())
            .catch((e: unknown) => {
              setDeleting(false);
              setError(errorMessage(e) || t.common.error);
            });
        },
      },
    ]);
  };

  return (
    <Screen top>
      <LocationForm name={formName} onNameChange={setName} kind={formKind} onKindChange={setKind} />
      <Text style={styles.count}>{t.locations.itemCount(count)}</Text>
      <ErrorText message={error} />
      <Button title={t.locations.save} onPress={save} loading={update.isPending} disabled={del.isPending} />

      {isLast ? <Text style={styles.hint}>{t.locations.lastLocation}</Text> : null}
      {!isLast && needsTarget ? (
        <>
          <Text style={styles.label}>{t.locations.moveItemsTo(count)}</Text>
          <LocationChips locations={all} value={validMoveTo} onChange={setMoveTo} exclude={loc.id} />
        </>
      ) : null}
      <Button
        title={t.locations.delete}
        variant="danger"
        onPress={remove}
        loading={del.isPending}
        disabled={isLast || (needsTarget && !validMoveTo) || update.isPending}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  count: { fontSize: 14, color: c.textMuted },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  hint: { fontSize: 14, color: c.textMuted, marginTop: spacing.sm },
}));
