import { useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, ErrorText, Field, LinkText, Screen, Subtitle, Title } from '../../components/ui';
import { createHousehold, joinHousehold } from '../../data/householdRepo';
import { nl } from '../../i18n/nl';
import { errorMessage } from '../../lib/errors';

export default function HouseholdScreen() {
  const { refreshHousehold, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [houseName, setHouseName] = useState(nl.household.defaultName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    if (!displayName.trim()) return setError(nl.household.nameRequired);
    setBusy('create');
    try {
      await createHousehold(houseName.trim() || nl.household.defaultName, displayName);
      await refreshHousehold();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onJoin() {
    setError(null);
    if (!displayName.trim()) return setError(nl.household.nameRequired);
    if (!code.trim()) return setError(nl.household.codeRequired);
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
      <Title>{nl.household.title}</Title>
      <Subtitle>{nl.household.subtitle}</Subtitle>
      <Field
        label={nl.household.yourName}
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
      />
      <ErrorText message={error} />
      <Card>
        <Title>{nl.household.newTitle}</Title>
        <Field label={nl.household.newName} value={houseName} onChangeText={setHouseName} />
        <Button title={nl.household.create} onPress={onCreate} loading={busy === 'create'} disabled={busy !== null} />
      </Card>
      <Card>
        <Title>{nl.household.joinTitle}</Title>
        <Field
          label={nl.household.code}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        <Button
          title={nl.household.join}
          variant="outline"
          onPress={onJoin}
          loading={busy === 'join'}
          disabled={busy !== null}
        />
      </Card>
      <LinkText title={nl.settings.logout} onPress={signOut} />
    </Screen>
  );
}
