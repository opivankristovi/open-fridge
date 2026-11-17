import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { CategoryChips } from '../components/CategoryChips';
import {
  defaultExpiryValue,
  ExpiryForm,
  expiryValueToFields,
  type ExpiryValue,
} from '../components/ExpiryForm';
import { PhotoCapture } from '../components/PhotoCapture';
import { Stepper } from '../components/Stepper';
import { Button, ErrorText, Field, Spinner } from '../components/ui';
import { useCreateItem, useHouseholdSettings } from '../data/hooks';
import { getProduct, upsertProduct } from '../data/productsRepo';
import { shelfDefaults, type CategoryKey } from '../domain/categories';
import { errorMessage } from '../lib/errors';
import { nl } from '../i18n/nl';
import { ensurePermission } from '../services/notifications';
import { lookupBarcode } from '../services/openFoodFacts';
import { deletePhoto, uploadItemPhoto } from '../services/photos';
import { colors, radius, spacing } from '../theme';

type Step = 'scan' | 'details' | 'photo' | 'expiry' | 'save';
type Lookup = 'idle' | 'loading' | 'found' | 'notfound';

const STEPS: Exclude<Step, 'save'>[] = ['scan', 'details', 'photo', 'expiry'];
const BARCODE_RE = /^[0-9]{6,14}$/;

export default function AddScreen() {
  const { household } = useAuth();
  const hid = household?.id as string;
  const settings = useHouseholdSettings();
  const createItem = useCreateItem();

  const [step, setStep] = useState<Step>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const [barcode, setBarcode] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>('idle');
  const [fromHousehold, setFromHousehold] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<CategoryKey>('overig');
  const [quantity, setQuantity] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastOpenedDays, setLastOpenedDays] = useState<number | null>(null);
  const [nameError, setNameError] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<ExpiryValue | null>(null);
  const [expiryCategory, setExpiryCategory] = useState<CategoryKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- barcode lookup: household memory first, then Open Food Facts -------------------------
  const lookupToken = useRef(0);
  const runLookup = async (code: string) => {
    const token = ++lookupToken.current;
    const stale = () => token !== lookupToken.current;
    setLookup('loading');
    try {
      const known = await getProduct(hid, code).catch(() => null);
      if (stale()) return;
      if (known) {
        setName(known.name);
        setBrand(known.brand ?? '');
        setCategory(known.category);
        setImageUrl(known.image_url);
        setLastOpenedDays(known.last_opened_shelf_days);
        setFromHousehold(true);
        setLookup('found');
        return;
      }
      const off = await lookupBarcode(code);
      if (stale()) return;
      if (off) {
        setName(off.name);
        setBrand(off.brand ?? '');
        setCategory(off.category);
        setImageUrl(off.image_url);
        setLookup('found');
      } else {
        setLookup('notfound');
      }
    } catch {
      if (!stale()) setLookup('notfound');
    }
  };

  // --- navigation ---------------------------------------------------------------------------
  const goBack = useCallback(() => {
    switch (step) {
      case 'scan':
        router.back();
        return;
      case 'details':
        scanned.current = false;
        lookupToken.current++;
        setLookup('idle');
        setBarcode(null);
        setFromHousehold(false);
        setName('');
        setBrand('');
        setCategory('overig');
        setImageUrl(null);
        setLastOpenedDays(null);
        setStep('scan');
        return;
      case 'photo':
        setStep('details');
        return;
      case 'expiry':
        setStep('photo');
        return;
      default:
        return;
    }
  }, [step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'scan') return false;
      if (step !== 'save') goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, goBack]);

  const onScan = ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    const valid = BARCODE_RE.test(data);
    setBarcode(valid ? data : null);
    setStep('details');
    if (valid) void runLookup(data);
    else setLookup('notfound');
  };

  const skipScan = () => {
    scanned.current = true;
    setBarcode(null);
    setLookup('notfound');
    setStep('details');
  };

  const toPhoto = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setStep('photo');
  };

  const toExpiry = (uri: string | null) => {
    setPhotoUri(uri);
    const overrides = settings.data?.category_defaults;
    if (!expiry) {
      setExpiry(defaultExpiryValue(category, overrides, lastOpenedDays));
    } else if (expiryCategory !== category) {
      // Category changed after the form was first shown: refresh only the shelf-life defaults.
      const d = shelfDefaults(category, overrides);
      setExpiry({ ...expiry, freshDays: d.fresh, openedDays: lastOpenedDays ?? d.opened });
    }
    setExpiryCategory(category);
    setStep('expiry');
  };

  // --- save ---------------------------------------------------------------------------------
  const save = async () => {
    if (!expiry) return;
    setError(null);
    setStep('save');
    const id = randomUUID();
    let photoPath: string | null = null;
    let photoFailed = false;
    try {
      await ensurePermission();
      if (photoUri) {
        try {
          photoPath = await uploadItemPhoto(hid, id, photoUri);
        } catch {
          photoFailed = true;
        }
      }
      const fields = expiryValueToFields(expiry);
      const cleanBrand = brand.trim() || null;
      try {
        await createItem.mutateAsync({
          id,
          household_id: hid,
          name: name.trim(),
          brand: cleanBrand,
          barcode,
          photo_path: photoPath,
          image_url: imageUrl,
          category,
          quantity,
          ...fields,
        });
      } catch (e) {
        if (photoPath) await deletePhoto(photoPath).catch(() => undefined);
        throw e;
      }
      if (barcode) {
        await upsertProduct({
          household_id: hid,
          barcode,
          name: name.trim(),
          brand: cleanBrand,
          image_url: imageUrl,
          category,
          ...(fields.opened_at ? { last_opened_shelf_days: fields.opened_shelf_days } : {}),
        }).catch(() => undefined);
      }
      if (photoFailed) {
        Alert.alert(nl.add.photoFailedTitle, nl.add.photoFailed, [{ text: nl.common.ok, onPress: () => router.back() }]);
      } else {
        router.back();
      }
    } catch (e) {
      setError(errorMessage(e) || nl.add.saveFailed);
      setStep('expiry');
    }
  };

  // --- render -------------------------------------------------------------------------------
  const stepIndex = STEPS.indexOf(step === 'save' ? 'expiry' : step);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          disabled={step === 'save'}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={styles.backText}>{nl.add.back}</Text>
        </Pressable>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.dotWrap}>
              <View style={[styles.dot, i <= stepIndex && styles.dotActive]} />
              <Text style={[styles.dotLabel, i === stepIndex && styles.dotLabelActive]}>{nl.add.steps[s]}</Text>
            </View>
          ))}
        </View>
      </View>

      {step === 'scan' ? (
        !permission ? (
          <Spinner />
        ) : !permission.granted ? (
          <View style={styles.padded}>
            <Text style={styles.centerText}>{nl.add.cameraPermission}</Text>
            <Button title={nl.add.allowCamera} onPress={requestPermission} />
            <Button title={nl.add.noBarcode} variant="outline" onPress={skipScan} />
          </View>
        ) : (
          <View style={styles.padded}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={onScan}
            />
            <Text style={styles.centerText}>{nl.add.scanHint}</Text>
            <Button title={nl.add.noBarcode} variant="outline" onPress={skipScan} />
          </View>
        )
      ) : null}

      {step === 'details' ? (
        lookup === 'loading' || lookup === 'idle' ? (
          <View style={styles.loading}>
            <Spinner />
            <Text style={styles.centerText}>{nl.add.lookingUp}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {lookup === 'notfound' && barcode ? <Text style={styles.notice}>{nl.add.notFound}</Text> : null}
            {lookup === 'found' ? (
              <Text style={styles.notice}>{fromHousehold ? nl.add.foundHousehold : nl.add.found}</Text>
            ) : null}
            <Field
              label={nl.add.name}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (t.trim()) setNameError(false);
              }}
              autoCapitalize="sentences"
            />
            {nameError ? <ErrorText message={nl.add.nameRequired} /> : null}
            <Field label={nl.add.brand} value={brand} onChangeText={setBrand} autoCapitalize="words" />
            <Text style={styles.label}>{nl.add.category}</Text>
            <CategoryChips value={category} onChange={(c) => c && setCategory(c)} />
            <Text style={styles.label}>{nl.add.quantity}</Text>
            <Stepper value={quantity} min={1} max={999} onChange={setQuantity} />
            <Button title={nl.add.next} onPress={toPhoto} />
          </ScrollView>
        )
      ) : null}

      {step === 'photo' ? (
        <View style={styles.padded}>
          <PhotoCapture onUse={(uri) => toExpiry(uri)} onSkip={() => toExpiry(null)} />
        </View>
      ) : null}

      {step === 'expiry' || step === 'save' ? (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {expiry ? <ExpiryForm value={expiry} onChange={setExpiry} /> : null}
          <ErrorText message={error} />
          <Button title={step === 'save' ? nl.add.saving : nl.add.save} onPress={save} loading={step === 'save'} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 40, alignSelf: 'flex-start' },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotWrap: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { height: 6, alignSelf: 'stretch', marginHorizontal: 2, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  dotLabel: { fontSize: 11, color: colors.textMuted },
  dotLabelActive: { color: colors.primary, fontWeight: '700' },
  padded: { flex: 1, padding: spacing.md, gap: spacing.md, justifyContent: 'center' },
  camera: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  centerText: { textAlign: 'center', fontSize: 16, color: colors.text },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  form: { padding: spacing.md, gap: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  notice: {
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    padding: spacing.md,
    borderRadius: radius.md,
    fontWeight: '600',
  },
});
