import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { CategoryChips } from '../components/CategoryChips';
import { LocationChips } from '../components/LocationChips';
import {
  defaultExpiryValue,
  ExpiryForm,
  expiryValueToFields,
  type ExpiryValue,
} from '../components/ExpiryForm';
import { PhotoCapture } from '../components/PhotoCapture';
import { Stepper } from '../components/Stepper';
import { Button, ErrorText, Field, Spinner } from '../components/ui';
import { useCreateItem, useHouseholdSettings, useLocations } from '../data/hooks';
import { usePrefs } from '../data/localPrefs';
import { getProduct, upsertProduct } from '../data/productsRepo';
import type { CategoryKey } from '../domain/categories';
import { defaultLocation, type LocationKind } from '../domain/locations';
import { shelfDefaults } from '../domain/shelfLife';
import { errorMessage } from '../lib/errors';
import { t } from '../i18n';
import { ensurePermission } from '../services/notifications';
import { lookupBarcode } from '../services/openFoodFacts';
import { deletePhoto, uploadItemPhoto } from '../services/photos';
import { makeStyles, useColors, radius, spacing } from '../theme';

type Step = 'scan' | 'details' | 'photo' | 'expiry' | 'save';
type Lookup = 'idle' | 'loading' | 'found' | 'notfound';

const STEPS: Exclude<Step, 'save'>[] = ['scan', 'details', 'photo', 'expiry'];
const BARCODE_RE = /^[0-9]{6,14}$/;

export default function AddScreen() {
  const styles = useStyles();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { household } = useAuth();
  const hid = household?.id as string;
  const settings = useHouseholdSettings();
  const createItem = useCreateItem();
  const locationsQuery = useLocations();
  const { prefs, update: updatePrefs } = usePrefs();
  const { locationId: locationParam } = useLocalSearchParams<{ locationId?: string }>();

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
  const [expiryKey, setExpiryKey] = useState<string | null>(null);
  const [pickedLocation, setPickedLocation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- location: picked chip, else route param, else last used, else the default -----------------
  const locations = locationsQuery.data ?? [];
  const multi = locations.length >= 2;
  const validId = (id: string | null | undefined) =>
    id && locations.some((l) => l.id === id) ? id : null;
  const locationId =
    validId(pickedLocation) ??
    validId(locationParam) ??
    validId(prefs.lastLocationId) ??
    defaultLocation(locations)?.id ??
    null;
  const kind: LocationKind = locations.find((l) => l.id === locationId)?.kind ?? 'fridge';

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
    const overrides = settings.data?.shelf_defaults;
    // What the household learned about opened shelf life only applies to fridges.
    const learned = kind === 'fridge' ? lastOpenedDays : null;
    const key = `${kind}:${category}`;
    if (!expiry) {
      setExpiry(defaultExpiryValue(kind, category, overrides, learned));
    } else if (expiryKey !== key) {
      // Category or location kind changed after the form was first shown: refresh only the shelf-life defaults.
      const d = shelfDefaults(kind, category, overrides);
      setExpiry({ ...expiry, freshDays: d.fresh, openedDays: learned ?? d.opened });
    }
    setExpiryKey(key);
    setStep('expiry');
  };

  // --- save ---------------------------------------------------------------------------------
  const save = async () => {
    if (!expiry || !locationId) return;
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
          location_id: locationId,
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
          ...(fields.opened_at && kind === 'fridge' ? { last_opened_shelf_days: fields.opened_shelf_days } : {}),
        }).catch(() => undefined);
      }
      void updatePrefs({ lastLocationId: locationId });
      if (photoFailed) {
        Alert.alert(t.add.photoFailedTitle, t.add.photoFailed, [{ text: t.common.ok, onPress: () => router.back() }]);
      } else {
        router.back();
      }
    } catch (e) {
      setError(errorMessage(e) || t.add.saveFailed);
      setStep('expiry');
    }
  };

  // --- render -------------------------------------------------------------------------------
  const stepIndex = STEPS.indexOf(step === 'save' ? 'expiry' : step);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          disabled={step === 'save'}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={c.primary} />
          <Text style={styles.backText}>{t.add.back}</Text>
        </Pressable>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.dotWrap}>
              <View style={[styles.dot, i <= stepIndex && styles.dotActive]} />
              <Text style={[styles.dotLabel, i === stepIndex && styles.dotLabelActive]}>{t.add.steps[s]}</Text>
            </View>
          ))}
        </View>
      </View>

      {step === 'scan' ? (
        !permission ? (
          <Spinner />
        ) : !permission.granted ? (
          <View style={styles.padded}>
            <Text style={styles.centerText}>{t.add.cameraPermission}</Text>
            <Button title={t.add.allowCamera} onPress={requestPermission} />
            <Button title={t.add.noBarcode} variant="outline" onPress={skipScan} />
          </View>
        ) : (
          <View style={styles.padded}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={onScan}
            />
            <Text style={styles.centerText}>{t.add.scanHint}</Text>
            <Button title={t.add.noBarcode} variant="outline" onPress={skipScan} />
          </View>
        )
      ) : null}

      {step === 'details' ? (
        lookup === 'loading' || lookup === 'idle' ? (
          <View style={styles.loading}>
            <Spinner />
            <Text style={styles.centerText}>{t.add.lookingUp}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {lookup === 'notfound' && barcode ? <Text style={styles.notice}>{t.add.notFound}</Text> : null}
            {lookup === 'found' ? (
              <Text style={styles.notice}>{fromHousehold ? t.add.foundHousehold : t.add.found}</Text>
            ) : null}
            <Field
              label={t.add.name}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (text.trim()) setNameError(false);
              }}
              autoCapitalize="sentences"
            />
            {nameError ? <ErrorText message={t.add.nameRequired} /> : null}
            <Field label={t.add.brand} value={brand} onChangeText={setBrand} autoCapitalize="words" />
            <Text style={styles.label}>{t.add.category}</Text>
            <CategoryChips value={category} onChange={(cat) => cat && setCategory(cat)} />
            {multi ? (
              <>
                <Text style={styles.label}>{t.locations.label}</Text>
                <LocationChips
                  locations={locations}
                  value={locationId}
                  onChange={(id) => id && setPickedLocation(id)}
                />
              </>
            ) : null}
            <Text style={styles.label}>{t.add.quantity}</Text>
            <Stepper value={quantity} min={1} max={999} onChange={setQuantity} />
            <Button title={t.add.next} onPress={toPhoto} />
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
          {expiry ? <ExpiryForm value={expiry} onChange={setExpiry} category={category} kind={kind} /> : null}
          <ErrorText message={error} />
          <Button
            title={step === 'save' ? t.add.saving : t.add.save}
            onPress={save}
            loading={step === 'save'}
            disabled={!locationId}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 40, alignSelf: 'flex-start' },
  backText: { color: c.primary, fontSize: 16, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotWrap: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { height: 6, alignSelf: 'stretch', marginHorizontal: 2, borderRadius: 3, backgroundColor: c.border },
  dotActive: { backgroundColor: c.primary },
  dotLabel: { fontSize: 11, color: c.textMuted },
  dotLabelActive: { color: c.primary, fontWeight: '700' },
  padded: { flex: 1, padding: spacing.md, gap: spacing.md, justifyContent: 'center' },
  camera: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  centerText: { textAlign: 'center', fontSize: 16, color: c.text },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  form: { padding: spacing.md, gap: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  notice: {
    backgroundColor: c.primaryLight,
    color: c.primaryDark,
    padding: spacing.md,
    borderRadius: radius.md,
    fontWeight: '600',
  },
}));
