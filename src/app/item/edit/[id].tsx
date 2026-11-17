import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryChips } from '../../../components/CategoryChips';
import {
  expiryValueFromItem,
  expiryValueToFields,
  ExpiryForm,
  type ExpiryValue,
} from '../../../components/ExpiryForm';
import { ItemImage } from '../../../components/ItemImage';
import { PhotoCapture } from '../../../components/PhotoCapture';
import { Stepper } from '../../../components/Stepper';
import { Button, ErrorText, Field, Spinner } from '../../../components/ui';
import { useHouseholdSettings, useItem, useUpdateItem } from '../../../data/hooks';
import type { CategoryKey } from '../../../domain/categories';
import { nl } from '../../../i18n/nl';
import { errorMessage } from '../../../lib/errors';
import { uploadItemPhoto } from '../../../services/photos';
import { colors, spacing } from '../../../theme';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);
  const settings = useHouseholdSettings();
  const updateItem = useUpdateItem();
  const qc = useQueryClient();

  const data = item.data;
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<CategoryKey>('overig');
  const [quantity, setQuantity] = useState(1);
  const [expiry, setExpiry] = useState<ExpiryValue | null>(null);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise the form once, when the item first arrives.
  useEffect(() => {
    if (ready || !data) return;
    setName(data.name);
    setBrand(data.brand ?? '');
    setCategory(data.category);
    setQuantity(data.quantity);
    setExpiry(expiryValueFromItem(data, settings.data?.category_defaults));
    setReady(true);
  }, [data, ready, settings.data]);

  if (item.isPending || (data && !ready)) return <Spinner />;
  if (!data || data.status !== 'in_fridge' || !expiry) {
    return (
      <View style={styles.gone}>
        <Text style={styles.goneText}>{nl.item.gone}</Text>
        <Button title={nl.add.back} variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  if (capturing) {
    return (
      <View style={styles.capture}>
        <PhotoCapture
          onUse={(uri) => {
            setNewPhoto(uri);
            setCapturing(false);
          }}
          onSkip={() => setCapturing(false)}
          skipLabel={nl.common.cancel}
        />
      </View>
    );
  }

  const save = async () => {
    if (!name.trim()) {
      setError(nl.add.nameRequired);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let photoPath = data.photo_path;
      if (newPhoto) {
        photoPath = await uploadItemPhoto(data.household_id, data.id, newPhoto);
        // The path is reused (upsert), so drop the cached signed url to show the new image.
        qc.removeQueries({ queryKey: ['photo', photoPath] });
      }
      await updateItem.mutateAsync({
        id: data.id,
        patch: {
          name: name.trim(),
          brand: brand.trim() || null,
          category,
          quantity,
          photo_path: photoPath,
          ...expiryValueToFields(expiry, data.opened_at),
        },
      });
      router.back();
    } catch (e) {
      setSaving(false);
      setError(errorMessage(e) || nl.add.saveFailed);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{nl.edit.currentPhoto}</Text>
      {newPhoto ? (
        <Image source={{ uri: newPhoto }} style={styles.preview} contentFit="cover" />
      ) : (
        <ItemImage item={{ ...data, category }} size={160} fill />
      )}
      <Button title={nl.edit.newPhoto} variant="outline" onPress={() => setCapturing(true)} disabled={saving} />

      <Field label={nl.add.name} value={name} onChangeText={setName} autoCapitalize="sentences" />
      <Field label={nl.add.brand} value={brand} onChangeText={setBrand} autoCapitalize="words" />
      <Text style={styles.label}>{nl.add.category}</Text>
      <CategoryChips value={category} onChange={(c) => c && setCategory(c)} />
      <Text style={styles.label}>{nl.add.quantity}</Text>
      <Stepper value={quantity} min={1} max={999} onChange={setQuantity} />

      <ExpiryForm value={expiry} onChange={setExpiry} addedAt={data.added_at} openedAt={data.opened_at} />

      <ErrorText message={error} />
      <Button title={nl.edit.save} onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background },
  capture: { flex: 1, padding: spacing.md, backgroundColor: colors.background },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  goneText: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  preview: { width: '100%', height: 160, borderRadius: 12, overflow: 'hidden' },
});
