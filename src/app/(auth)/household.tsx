import { useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, ErrorText, Field, LinkText, Screen, Subtitle, Title } from '../../components/ui';
import { createHousehold, joinHousehold } from '../../data/householdRepo';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';

export default function HouseholdScreen() {
  const { refreshHousehold, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [houseName, setHouseName] = useState(t.household.defaultName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    if (!displayName.trim()) return setError(t.household.nameRequired);
    setBusy('create');
    try {
      await createHousehold(houseName.trim() || t.household.defaultName, displayName);
      await refreshHousehold();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onJoin() {
    setError(null);
    if (!displayName.trim()) return setError(t.household.nameRequired);
    if (!code.trim()) return setError(t.household.codeRequired);
    setBusy('join');
    try {
      await joinHousehold(code, displayName);
      await refreshHousehold();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Title>{t.household.title}</Title>
      <Subtitle>{t.household.subtitle}</Subtitle>
      <Field
        label={t.household.yourName}
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
      />
      <ErrorText message={error} />
      <Card>
        <Title>{t.household.newTitle}</Title>
        <Field label={t.household.newName} value={houseName} onChangeText={setHouseName} />
        <Button title={t.household.create} onPress={onCreate} loading={busy === 'create'} disabled={busy !== null} />
      </Card>
      <Card>
        <Title>{t.household.joinTitle}</Title>
        <Field
          label={t.household.code}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        <Button
          title={t.household.join}
          variant="outline"
          onPress={onJoin}
          loading={busy === 'join'}
          disabled={busy !== null}
        />
      </Card>
      <LinkText title={t.settings.logout} onPress={signOut} />
    </Screen>
  );
}
