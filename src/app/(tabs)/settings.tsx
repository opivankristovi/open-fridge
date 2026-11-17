import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { Stepper } from '../../components/Stepper';
import { Button, Card, ErrorText, Screen, Subtitle } from '../../components/ui';
import { regenerateInviteCode } from '../../data/householdRepo';
import { useHouseholdSettings, useMembers, useUpdateCategoryDefaults } from '../../data/hooks';
import { usePrefs } from '../../data/localPrefs';
import { CATEGORIES, shelfDefaults, type CategoryKey } from '../../domain/categories';
import { nl } from '../../i18n/nl';
import { errorMessage } from '../../lib/errors';
import {
  cancelAllNotifications,
  ensurePermission,
  getPermissionStatus,
  requestResync,
  sendTestNotification,
} from '../../services/notifications';
import { colors, spacing } from '../../theme';
import type { HouseholdSettings } from '../../types/db';

const KEYS = Object.keys(CATEGORIES) as CategoryKey[];

type Defaults = HouseholdSettings['category_defaults'];

export default function SettingsScreen() {
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

  // --- category defaults: local copy, saved with a short debounce ---------------------------
  const [defaults, setDefaults] = useState<Defaults>({});
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty.current && settings.data) setDefaults(settings.data.category_defaults ?? {});
  }, [settings.data]);

  const changeDefault = (cat: CategoryKey, field: 'fresh' | 'opened', value: number) => {
    const current = shelfDefaults(cat, defaults);
    const next: Defaults = { ...defaults, [cat]: { fresh: current.fresh, opened: current.opened, [field]: value } };
    dirty.current = true;
    setDefaults(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDefaults.mutate(next, {
        onSuccess: () => {
          dirty.current = false;
        },
        onError: () => setError(nl.settings.saveFailed),
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
    const ok = await sendTestNotification(nl.settings.testTitle, nl.settings.testBody);
    refreshPermission();
    setInfo(ok ? nl.settings.testSent : nl.settings.testNoPermission);
  };

  const onShare = () => {
    if (!household) return;
    void Share.share({ message: nl.settings.shareMessage(household.invite_code) });
  };

  const onNewCode = async () => {
    if (!household) return;
    setCodeBusy(true);
    setError(null);
    try {
      await regenerateInviteCode(household.id);
      await refreshHousehold();
    } catch (e) {
      setError(errorMessage(e) || nl.settings.newCodeFailed);
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
      ? nl.settings.permissionGranted
      : permission === 'denied'
        ? nl.settings.permissionDenied
        : nl.settings.permissionUndetermined;

  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>{nl.settings.notifications}</Text>
        <Subtitle>{nl.settings.notificationsHint}</Subtitle>

        <Text style={styles.label}>{nl.settings.warnDays}</Text>
        <Stepper
          value={prefs.warnDays}
          min={0}
          max={7}
          onChange={(n) => changePrefs({ warnDays: n })}
          format={nl.settings.warnDaysValue}
        />

        <Text style={styles.label}>{nl.settings.notifyHour}</Text>
        <Stepper
          value={prefs.notifyHour}
          min={6}
          max={22}
          onChange={(n) => changePrefs({ notifyHour: n })}
          format={(n) => `${String(n).padStart(2, '0')}:00`}
        />

        <Text style={styles.label}>
          {nl.settings.permission}: {permissionLabel}
        </Text>
        {permission !== 'granted' ? (
          <Button
            title={permission === 'denied' ? nl.settings.permissionOpenSettings : nl.settings.permissionRequest}
            variant="outline"
            onPress={onPermission}
          />
        ) : null}
        <Button title={nl.settings.testNotification} variant="outline" onPress={onTest} />
        {info ? <Text style={styles.info}>{info}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.heading}>{nl.settings.shelfLife}</Text>
        <Subtitle>{nl.settings.shelfLifeHint}</Subtitle>
        {KEYS.map((cat) => {
          const d = shelfDefaults(cat, defaults);
          return (
            <View key={cat} style={styles.catBlock}>
              <Text style={styles.catName}>{CATEGORIES[cat].label}</Text>
              <View style={styles.catRow}>
                <Text style={styles.catLabel}>{nl.settings.fresh}</Text>
                <Stepper value={d.fresh} min={0} max={365} onChange={(n) => changeDefault(cat, 'fresh', n)} />
              </View>
              <View style={styles.catRow}>
                <Text style={styles.catLabel}>{nl.settings.opened}</Text>
                <Stepper value={d.opened} min={0} max={365} onChange={(n) => changeDefault(cat, 'opened', n)} />
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.heading}>{nl.settings.household}</Text>
        <Text style={styles.householdName}>{household?.name}</Text>
        <Subtitle>{nl.settings.inviteCode}</Subtitle>
        <Text selectable style={styles.code}>
          {household?.invite_code}
        </Text>
        <Subtitle>{nl.settings.inviteHint}</Subtitle>
        <Button title={nl.settings.share} onPress={onShare} />
        {membership?.role === 'owner' ? (
          <Button
            title={nl.settings.newCode}
            variant="outline"
            loading={codeBusy}
            onPress={() =>
              Alert.alert(nl.settings.newCode, nl.settings.inviteHint, [
                { text: nl.common.cancel, style: 'cancel' },
                { text: nl.settings.newCode, onPress: () => void onNewCode() },
              ])
            }
          />
        ) : null}
        <ErrorText message={error} />
        <Text style={styles.label}>{nl.settings.members}</Text>
        {(members.data ?? []).map((m) => (
          <Text key={m.user_id} style={styles.member}>
            {m.display_name}
            {m.role === 'owner' ? ` (${nl.settings.owner})` : ''}
          </Text>
        ))}
      </Card>

      <Button title={nl.settings.logout} variant="danger" onPress={onLogout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  info: { fontSize: 14, color: colors.primaryDark },
  catBlock: { gap: spacing.sm, paddingTop: spacing.sm },
  catName: { fontSize: 15, fontWeight: '700', color: colors.text },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catLabel: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  householdName: { fontSize: 22, fontWeight: '700', color: colors.text },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 6, color: colors.primary },
  member: { fontSize: 15, color: colors.text },
});
