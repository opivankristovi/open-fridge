import * as Device from 'expo-device';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Share, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { Segmented } from '../../components/Segmented';
import { OpenedShelfInput } from '../../components/OpenedShelfInput';
import { Stepper } from '../../components/Stepper';
import { Button, Card, ErrorText, LinkText, Screen, Subtitle } from '../../components/ui';
import { regenerateInviteCode } from '../../data/householdRepo';
import { useHouseholdSettings, useMembers, useUpdateCategoryDefaults } from '../../data/hooks';
import { usePrefs, type ThemePref } from '../../data/localPrefs';
import { CATEGORIES, categoryLabel, shelfDefaults, type CategoryKey } from '../../domain/categories';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import {
  cancelAllNotifications,
  ensurePermission,
  getExactAlarmStatus,
  getPermissionStatus,
  requestExactAlarms,
  requestResync,
  sendTestNotification,
} from '../../services/notifications';
import { makeStyles, spacing } from '../../theme';
import type { HouseholdSettings } from '../../types/db';

const KEYS = Object.keys(CATEGORIES) as CategoryKey[];

type Defaults = HouseholdSettings['category_defaults'];

export default function SettingsScreen() {
  const styles = useStyles();
  const { household, membership, refreshHousehold, signOut } = useAuth();
  const { prefs, update } = usePrefs();
  const members = useMembers();
  const settings = useHouseholdSettings();
  const saveDefaults = useUpdateCategoryDefaults();

  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const refreshPermission = useCallback(() => {
    getPermissionStatus().then(setPermission).catch(() => undefined);
  }, []);
  useEffect(refreshPermission, [refreshPermission]);

  const [exactGranted, setExactGranted] = useState(true);
  const refreshExact = useCallback(() => {
    getExactAlarmStatus().then(setExactGranted).catch(() => undefined);
  }, []);
  useEffect(() => {
    refreshExact();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshExact();
        refreshPermission();
      }
    });
    return () => sub.remove();
  }, [refreshExact, refreshPermission]);
  const isXiaomi = /xiaomi|redmi|poco/i.test(Device.manufacturer ?? '');

  const onExactAlarm = async () => {
    await requestExactAlarms();
    refreshExact();
  };

  // --- category defaults: local copy, saved with a short debounce ---------------------------
  const [defaults, setDefaults] = useState<Defaults>({});
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty.current && settings.data) setDefaults(settings.data.category_defaults ?? {});
  }, [settings.data]);

  const changeDefault = (cat: CategoryKey, field: 'fresh' | 'opened', value: number | null) => {
    const current = shelfDefaults(cat, defaults);
    // An explicit null for `opened` is kept on purpose: it means "tot datum op verpakking".
    persist({ ...defaults, [cat]: { fresh: current.fresh, opened: current.opened, [field]: value } });
  };

  const resetDefault = (cat: CategoryKey) => {
    const rest = { ...defaults };
    delete rest[cat];
    persist(rest);
  };

  const persist = (next: Defaults) => {
    dirty.current = true;
    setDefaults(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDefaults.mutate(next, {
        onSuccess: () => {
          dirty.current = false;
        },
        onError: () => setError(t.settings.saveFailed),
      });
    }, 600);
  };

  const changePrefs = async (patch: Partial<typeof prefs>) => {
    await update(patch);
    requestResync();
  };

  const onPermission = async () => {
    if (permission === 'denied') {
      const granted = await ensurePermission();
      if (!granted) await Linking.openSettings().catch(() => undefined);
    } else {
      await ensurePermission();
    }
    refreshPermission();
    requestResync();
  };

  const onTest = async () => {
    setInfo(null);
    const ok = await sendTestNotification(t.settings.testTitle, t.settings.testBody);
    refreshPermission();
    setInfo(ok ? t.settings.testSent : t.settings.testNoPermission);
  };

  const onShare = () => {
    if (!household) return;
    void Share.share({ message: t.settings.shareMessage(household.invite_code) });
  };

  const onNewCode = async () => {
    if (!household) return;
    setCodeBusy(true);
    setError(null);
    try {
      await regenerateInviteCode(household.id);
      await refreshHousehold();
    } catch (e) {
      setError(errorMessage(e) || t.settings.newCodeFailed);
    } finally {
      setCodeBusy(false);
    }
  };

  const onLogout = async () => {
    await cancelAllNotifications();
    await signOut();
  };

  const permissionLabel =
    permission === 'granted'
      ? t.settings.permissionGranted
      : permission === 'denied'
        ? t.settings.permissionDenied
        : t.settings.permissionUndetermined;

  return (
    <Screen bottomInset={false}>
      <Card>
        <Text style={styles.heading}>{t.settings.notifications}</Text>
        <Subtitle>{t.settings.notificationsHint}</Subtitle>

        <Text style={styles.label}>{t.settings.warnDays}</Text>
        <Stepper
          value={prefs.warnDays}
          min={0}
          max={7}
          onChange={(n) => changePrefs({ warnDays: n })}
          format={t.settings.warnDaysValue}
        />

        <Text style={styles.label}>{t.settings.notifyHour}</Text>
        <Stepper
          value={prefs.notifyHour}
          min={6}
          max={22}
          onChange={(n) => changePrefs({ notifyHour: n })}
          format={(n) => `${String(n).padStart(2, '0')}:00`}
        />

        <Text style={styles.label}>
          {t.settings.permission}: {permissionLabel}
        </Text>
        {permission !== 'granted' ? (
          <Button
            title={permission === 'denied' ? t.settings.permissionOpenSettings : t.settings.permissionRequest}
            variant="outline"
            onPress={onPermission}
          />
        ) : null}

        <Text style={styles.label}>
          {t.settings.exactAlarm}: {exactGranted ? t.settings.permissionGranted : t.settings.exactAlarmOff}
        </Text>
        {!exactGranted ? (
          <>
            <Text style={styles.info}>{t.settings.exactAlarmHint}</Text>
            <Button title={t.settings.exactAlarmAllow} variant="outline" onPress={onExactAlarm} />
          </>
        ) : null}
        {isXiaomi ? (
          <>
            <Text style={styles.info}>{t.settings.xiaomiHint}</Text>
            <Button title={t.settings.openAppSettings} variant="outline" onPress={() => void Linking.openSettings()} />
          </>
        ) : null}
        <Button title={t.settings.testNotification} variant="outline" onPress={onTest} />
        {info ? <Text style={styles.info}>{info}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.heading}>{t.settings.appearance}</Text>
        <Subtitle>{t.settings.appearanceHint}</Subtitle>
        <Segmented<ThemePref>
          value={prefs.theme}
          options={[
            { value: 'system', label: t.settings.themeSystem },
            { value: 'light', label: t.settings.themeLight },
            { value: 'dark', label: t.settings.themeDark },
          ]}
          onChange={(theme) => void update({ theme })}
        />
      </Card>

      <Card>
        <Text style={styles.heading}>{t.settings.shelfLife}</Text>
        <Subtitle>{t.settings.shelfLifeHint}</Subtitle>
        <Text style={styles.explain}>
          <Text style={styles.bold}>{t.settings.explainFreshLabel}</Text>
          {t.settings.explainFresh}
          <Text style={styles.bold}>{t.settings.explainOpenedLabel}</Text>
          {t.settings.explainOpened}
        </Text>
        {KEYS.map((cat) => {
          const d = shelfDefaults(cat, defaults);
          return (
            <View key={cat} style={styles.catBlock}>
              <Text style={styles.catName}>{categoryLabel(cat)}</Text>
              <View style={styles.catRow}>
                <Text style={styles.catLabel}>{t.settings.fresh}</Text>
                <Stepper value={d.fresh} min={0} max={365} onChange={(n) => changeDefault(cat, 'fresh', n)} />
              </View>
              {CATEGORIES[cat].canOpen ? (
                <View style={styles.catBlockInner}>
                  <Text style={styles.catLabel}>{t.settings.opened}</Text>
                  <OpenedShelfInput
                    value={d.opened}
                    onChange={(n) => changeDefault(cat, 'opened', n)}
                    fallbackDays={CATEGORIES[cat].opened ?? 3}
                  />
                </View>
              ) : null}
              {defaults[cat] ? (
                <LinkText title={t.settings.resetDefault} onPress={() => resetDefault(cat)} />
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.heading}>{t.settings.household}</Text>
        <Text style={styles.householdName}>{household?.name}</Text>
        <Subtitle>{t.settings.inviteCode}</Subtitle>
        <Text selectable style={styles.code}>
          {household?.invite_code}
        </Text>
        <Subtitle>{t.settings.inviteHint}</Subtitle>
        <Button title={t.settings.share} onPress={onShare} />
        {membership?.role === 'owner' ? (
          <Button
            title={t.settings.newCode}
            variant="outline"
            loading={codeBusy}
            onPress={() =>
              Alert.alert(t.settings.newCode, t.settings.inviteHint, [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.settings.newCode, onPress: () => void onNewCode() },
              ])
            }
          />
        ) : null}
        <ErrorText message={error} />
        <Text style={styles.label}>{t.settings.members}</Text>
        {(members.data ?? []).map((m) => (
          <Text key={m.user_id} style={styles.member}>
            {m.display_name}
            {m.role === 'owner' ? ` (${t.settings.owner})` : ''}
          </Text>
        ))}
      </Card>

      <Button title={t.settings.logout} variant="danger" onPress={onLogout} />
    </Screen>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '800', color: c.text },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  info: { fontSize: 14, color: c.primaryDark },
  catBlock: { gap: spacing.sm, paddingTop: spacing.sm },
  catName: { fontSize: 15, fontWeight: '700', color: c.text },
  explain: { fontSize: 13, color: c.textMuted, lineHeight: 19 },
  bold: { fontWeight: '800', color: c.text },
  catBlockInner: { gap: spacing.sm },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catLabel: { fontSize: 13, color: c.textMuted, flexShrink: 1 },
  householdName: { fontSize: 22, fontWeight: '700', color: c.text },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 6, color: c.primary },
  member: { fontSize: 15, color: c.text },
}));
